"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, Trophy, BowArrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BowTypeTag from "@/components/BowTypeTag";

type ClubRecord = {
    id: string;
    round_name: string;
    bow_type: string;
    experience: string;
    category: string;
    score: number;
    user_id: string;
    score_date: string | null;
    created_at: string;
    profiles?: { username: string; avatar_url: string | null };
};

type RecordHistory = {
    id: string;
    previous_score: number | null;
    new_score: number;
    previous_user_id: string | null;
    new_user_id: string;
    changed_at: string;
    profiles_new?: { username: string | null; avatar_url: string | null };
    profiles_old?: { username: string | null; avatar_url: string | null };
};

export default function ClubRecordsPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const searchParams = useSearchParams();

    const [records, setRecords] = useState<ClubRecord[]>([]);
    const [allRounds, setAllRounds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRound, setSelectedRound] = useState<string | null>(null);
    const [history, setHistory] = useState<RecordHistory[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeRecord, setActiveRecord] = useState<ClubRecord | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);
    const [checkingClub, setCheckingClub] = useState(true);

    /* ----------------------------------------------
        LOAD USER CLUB
    ---------------------------------------------- */
    useEffect(() => {
        async function getClubId() {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                setCheckingClub(false);
                return;
            }

            const { data, error } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", user.id)
                .maybeSingle();

            if (!error) setClubId(data?.club_id ?? null);
            setCheckingClub(false);
        }
        getClubId();
    }, [supabase]);

    /* ----------------------------------------------
        HANDLE ?round= PARAM
    ---------------------------------------------- */
    useEffect(() => {
        const r = searchParams.get("round");
        if (r) setSelectedRound(r);
    }, [searchParams]);

    /* ----------------------------------------------
        FETCH ALL ROUNDS FOR CLUB
    ---------------------------------------------- */
    useEffect(() => {
        if (!clubId) return;

        async function fetchRounds() {
            const { data, error } = await supabase
                .from("club_posts")
                .select("round_name")
                .eq("club_id", clubId)
                .neq("score_type", "Informal Practice");

            if (!error && data) {
                const typed = data as { round_name: string | null }[];
                const rounds = Array.from(
                    new Set(
                        typed.map(r => r.round_name ?? "").filter(r => r.length > 0)
                    )
                );

                setAllRounds(rounds);

                if (!selectedRound) {
                    const def = rounds.find(r =>
                        r.toLowerCase().includes("portsmouth")
                    );
                    if (def) setSelectedRound(def);
                }
            }
        }

        fetchRounds();
    }, [supabase, clubId, selectedRound]);

    /* ----------------------------------------------
        FETCH RECORDS
    ---------------------------------------------- */
    useEffect(() => {
        if (!selectedRound || !clubId) return;

        async function fetchRecords() {
            setLoading(true);

            const { data, error } = await supabase
                .from("club_posts")
                .select(`
                    id, round_name, bow_type, experience, category,
                    score, score_type, score_date, created_at, user_id,
                    profiles (username, avatar_url)
                `)
                .eq("club_id", clubId)
                .eq("round_name", selectedRound)
                .neq("score_type", "Informal Practice")
                .order("score", { ascending: false });

            if (error) {
                console.error(error);
                setRecords([]);
                setLoading(false);
                return;
            }

            // collapse into best per category/bow/experience
            const best = Object.values(
                (data || []).reduce((acc: Record<string, ClubRecord>, post: any) => {
                    const key = `${post.bow_type}-${post.category}-${post.experience}`;
                    if (!acc[key] || post.score > acc[key].score) acc[key] = post;
                    return acc;
                }, {})
            ) as ClubRecord[];

            setRecords(best);
            setLoading(false);
        }

        fetchRecords();
    }, [supabase, selectedRound, clubId]);

    /* ----------------------------------------------
        CHANGE ROUND
    ---------------------------------------------- */
    function chooseRound(r: string) {
        setSelectedRound(r);
        const params = new URLSearchParams();
        params.set("round", r);
        router.replace(`/dashboard/club-records?${params.toString()}`);
        setSearchTerm("");
    }

    /* ----------------------------------------------
        LOAD HISTORY FOR RECORD
    ---------------------------------------------- */
    async function loadHistory(record: ClubRecord) {
        setActiveRecord(record);

        const { data, error } = await supabase
            .from("club_record_history")
            .select(`
                id, previous_score, new_score, changed_at,
                previous_user_id, new_user_id,
                profiles_new:profiles!new_user_id(username, avatar_url),
                profiles_old:profiles!previous_user_id(username, avatar_url)
            `)
            .eq("club_id", clubId)
            .eq("round_name", record.round_name)
            .eq("bow_type", record.bow_type)
            .eq("category", record.category)
            .eq("experience", record.experience)
            .order("changed_at", { ascending: false });

        if (!error) {
            setHistory(
                (data || []).map((h: any) => ({
                    ...h,
                    profiles_new: Array.isArray(h.profiles_new)
                        ? h.profiles_new[0]
                        : h.profiles_new,
                    profiles_old: Array.isArray(h.profiles_old)
                        ? h.profiles_old[0]
                        : h.profiles_old,
                }))
            );
        }
    }

    const filteredRounds = allRounds.filter(r =>
        r.toLowerCase().includes(searchTerm.toLowerCase())
    );

    /* ----------------------------------------------
        LOADING / NO CLUB
    ---------------------------------------------- */
    if (checkingClub) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh]">
                <p className="text-muted-foreground">Loading club details…</p>
            </main>
        );
    }

    if (clubId === null) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                    <BowArrow className="w-8 h-8" />
                    <h1 className="text-2xl font-semibold">Club Membership Required</h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You must belong to a club to view club records.
                </p>

                <Button onClick={() => (window.location.href = "/")}>
                    Join a club
                </Button>
            </main>
        );
    }

    /* ----------------------------------------------
        MAIN UI
    ---------------------------------------------- */
    return (
        <main className="max-w-4xl mx-auto p-6 space-y-10">

            {/* HEADER */}
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-sky-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
                    <Trophy className="w-7 h-7 text-yellow-500" />
                    Club Records
                </h1>

                <p className="text-sm text-muted-foreground">
                    View your club’s all-time leading scores.
                </p>

                <div className="
    w-48 h-[2px] mx-auto mt-3 rounded-full
    bg-gradient-to-r from-emerald-500 to-sky-500 opacity-60
">
                </div>
            </div>

            {/* ROUND SELECT */}
            <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="
    rounded-3xl border border-border/60 bg-muted/40 px-5 py-6 shadow-sm
    relative overflow-hidden
    before:absolute before:inset-0 before:pointer-events-none
    before:bg-gradient-to-br before:from-emerald-500/10 before:via-sky-500/10 before:to-emerald-500/10
    before:blur-lg
"
            >
                <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-emerald-500/15 via-sky-500/15 to-emerald-500/15 blur-xl pointer-events-none"></div>

                <div className="relative flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">

                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.12em] font-medium text-muted-foreground">
                            Select Round
                        </p>
                        <p className="text-xs text-muted-foreground/80">
                            Search and choose a round to view club standings.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Input
                            placeholder="Search rounds…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 rounded-xl border-border/60 bg-background/80 text-sm"
                        />
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                            size={16}
                        />

                        {searchTerm && (
                            <div className="
                                absolute w-full bg-background border border-border/60
                            rounded-xl mt-2 shadow-lg z-30 max-h-60 overflow-auto text-sm                            ">
                                {filteredRounds.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => chooseRound(r)}
                                        className={`block w-full text-left px-3 py-2 transition ${r === selectedRound
                                                ? "bg-muted/70 text-primary font-medium"
                                                : "hover:bg-muted/50"
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}

                                {filteredRounds.length === 0 && (
                                    <div className="px-3 py-2 text-muted-foreground">No rounds found.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.section>

            {/* SELECTED ROUND BADGE */}
            {selectedRound && (
                <div className="flex justify-center">
                    <span className="
    relative inline-flex items-center px-5 py-1.5 rounded-full text-sm font-semibold
    text-emerald-700 dark:text-emerald-300 bg-muted/30
    border border-transparent
    before:absolute before:inset-0 before:rounded-full
    before:bg-gradient-to-r before:from-emerald-500/40 before:to-sky-500/40
    before:-z-10
">
                        {selectedRound}
                    </span>
                </div>
            )}

            {/* RECORD LIST */}
            {selectedRound && (
                <section className="space-y-6">

                    <div className="w-full h-px bg-gradient-to-r from-emerald-600/40 via-sky-500/40 to-emerald-600/40"></div>

                    {loading ? (
                        <p className="text-center text-muted-foreground">Loading records…</p>
                    ) : records.length === 0 ? (
                        <p className="text-center text-muted-foreground">No records found for this round.</p>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-6">

                            {records.map(r => (
                                <div key={r.id} className="group relative">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        transition={{ duration: 0.25 }}
                                        className="
    relative p-5 rounded-2xl border border-border/60 bg-muted/40 
    transition shadow-sm hover:shadow-md hover:bg-muted/60 overflow-hidden
    before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px]
    before:bg-gradient-to-r before:from-emerald-500 before:to-sky-500
    before:rounded-t-2xl
"
                                    >
                                        {/* Glow layer */}
                                        <div className="
                                            absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-40
                                            bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-emerald-500/20
                                            blur-xl pointer-events-none transition-opacity
                                        "></div>

                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {r.experience} • {r.category}
                                                <BowTypeTag bow={r.bow_type} />
                                            </div>
                                            <Trophy className="text-yellow-500" size={18} />
                                        </div>

                                        <div className="flex gap-3 items-center relative">
                                            <div className="
        absolute inset-0 -z-10 
        bg-gradient-to-b from-emerald-500/5 to-sky-500/5 
        blur-xl rounded-xl
    "></div>
                                            {r.profiles?.avatar_url ? (
                                                <img
                                                    src={r.profiles.avatar_url}
                                                    className="w-12 h-12 rounded-full border border-border/50 object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">?</div>
                                            )}

                                            <div>
                                                <p className="text-4xl font-bold">{r.score}</p>

                                                <p className="text-sm text-muted-foreground">
                                                    {r.profiles?.username || "Unknown"}
                                                </p>

                                                <p className="text-xs text-muted-foreground/70">
                                                    {new Date(r.score_date ?? r.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-4 rounded-lg"
                                            onClick={() => loadHistory(r)}
                                        >
                                            <Clock size={14} className="mr-1" /> History
                                        </Button>
                                    </motion.div>
                                </div>
                            ))}

                        </div>
                    )}

                </section>
            )}

            {/* HISTORY MODAL */}
            <AnimatePresence>
                {history && (
                    <motion.div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setHistory(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-background p-6 rounded-2xl shadow-xl max-w-lg w-full border border-border/50 relative"
                        >
                            <div className="
    absolute inset-x-0 -top-[2px] h-[3px]
    bg-gradient-to-r from-emerald-500 to-sky-500
    rounded-full
"></div>

                            <h3 className="text-xl font-semibold text-center mb-4 tracking-wide bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
                                Record History
                            </h3>

                            <div className="max-h-96 overflow-auto px-2 py-2 relative">
                                <div
                                    className="
        absolute top-0 bottom-0 w-[3px]
        bg-gradient-to-b from-emerald-500 to-sky-500
        rounded-full 
        -z-10
    "
                                    style={{
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        pointerEvents: "none",
                                    }}
                                ></div>

                                <div className="flex flex-col gap-10 items-center">

                                    {/* CURRENT RECORD */}
                                    {activeRecord && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col items-center text-center"
                                        >
                                            <div className="w-16 h-16 rounded-full border border-border/50 bg-background flex items-center justify-center z-10">
                                                <img
                                                    src={activeRecord.profiles?.avatar_url || "/default-avatar.png"}
                                                    className="w-16 h-16 rounded-full object-cover"
                                                />
                                            </div>

                                            <div className="mt-3 px-4 py-3 rounded-lg border border-border/40 bg-muted/30 shadow-sm w-64">
                                                <p className="font-medium">
                                                    {activeRecord.profiles?.username}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Current record: <span className="font-semibold text-emerald-600">{activeRecord.score}</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(activeRecord.score_date ?? activeRecord.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* PREVIOUS ENTRIES */}
                                    {history
                                        .filter(h => h.new_score !== activeRecord?.score)
                                        .map((h, idx) => (
                                            <motion.div
                                                key={h.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex flex-col items-center text-center"
                                            >
                                                <div className={`
                                                    w-16 h-16 rounded-full border-2
                                                    ${idx === 0 ? "border-blue-400" : "border-border/40"}
                                                    bg-background flex items-center justify-center z-10
                                                `}>
                                                    <img
                                                        src={h.profiles_new?.avatar_url || "/default-avatar.png"}
                                                        className="w-14 h-14 rounded-full object-cover"
                                                    />
                                                </div>

                                                <div className="mt-3 px-4 py-2 rounded-lg border border-border/40 bg-muted/30 shadow-sm w-56">
                                                    <p className="font-medium">{h.profiles_new?.username}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        set a new record of{" "}
                                                        <span className="font-semibold text-emerald-600">
                                                            {h.new_score}
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground/70">
                                                        {new Date(h.changed_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))}
                                </div>
                            </div>

                            <Button
                                className="mt-4 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-sky-500 text-white shadow hover:opacity-90"
                                onClick={() => setHistory(null)}
                            >
                                Close
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}