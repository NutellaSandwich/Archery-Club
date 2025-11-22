"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, Trophy, BowArrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


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

    // ✅ Load user's club ID
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

            if (error) console.error("Failed to load club:", error);
            else setClubId(data?.club_id ?? null);

            setCheckingClub(false); // ✅ done checking
        }
        getClubId();
    }, [supabase]);

    // ✅ Handle deep-link param (?round=)
    useEffect(() => {
        const round = searchParams.get("round");
        if (round) setSelectedRound(round);
    }, [searchParams]);

    useEffect(() => {
        if (!clubId) return;

        async function fetchRounds() {
            const { data, error } = await supabase
                .from("club_posts")
                .select("round_name")
                .eq("club_id", clubId)
                .neq("score_type", "Informal Practice")
                .order("round_name");

            if (!error && data) {
                const typedData = data as { round_name: string }[];

                const rounds = Array.from(new Set(typedData.map((r) => r.round_name)));
                setAllRounds(rounds);

                // ✅ Default to "Portsmouth" if available
                if (!selectedRound) {
                    const defaultRound = rounds.find((r) =>
                        r.toLowerCase().includes("portsmouth")
                    );
                    if (defaultRound) {
                        setSelectedRound(defaultRound);
                    }
                }
            }
        }

        fetchRounds();
    }, [supabase, clubId, selectedRound]);

    // ✅ Fetch records for selected round (for this club)
    useEffect(() => {
        if (!selectedRound || !clubId) return;

        async function fetchRecords() {
            setLoading(true);
            const { data, error } = await supabase
                .from("club_posts")
                .select(`
          id,
          round_name,
          bow_type,
          experience,
          category,
          score,
          score_type,
          score_date,
          created_at,
          user_id,
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
    }, [supabase, selectedRound, clubId]); // 🟢 FIXED: added clubId

    // ✅ Keep URL synced
    function chooseRound(r: string) {
        setSelectedRound(r);
        const params = new URLSearchParams();
        params.set("round", r);
        router.replace(`/dashboard/club-records?${params.toString()}`);
        setSearchTerm("");
    }

    // ✅ Load history for a specific record
    async function loadHistory(record: ClubRecord) {
        setActiveRecord(record);

        const { data, error } = await supabase
            .from("club_record_history")
            .select(`
        id,
        previous_score,
        new_score,
        changed_at,
        previous_user_id,
        new_user_id,
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

    const filteredRounds = allRounds.filter((r) =>
        r.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (checkingClub) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
                <p className="text-muted-foreground">Loading club details...</p>
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
                    You need to be part of a club to access club records. Please join or request to join a
                    club first from the main page.
                </p>
                <Button onClick={() => (window.location.href = "/")}>Join a club</Button>
            </main>
        );
    }

    // 🖼️ UI
    return (
        <main className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold mb-2 flex items-center justify-center gap-2 text-center">
                <Trophy className="text-yellow-500" size={24} />
                Club Records
            </h1>
            <p className="text-center text-muted-foreground text-sm">
                View all-time best scores for your club by round.
            </p>

            {/* Round Selector */}
            <div className="relative max-w-md mx-auto">
                <Input
                    placeholder="Search for a round..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
                <Search
                    className="absolute left-3 top-3 text-muted-foreground/60"
                    size={16}
                />

                {searchTerm && (
                    <div className="absolute bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 rounded-lg mt-1 shadow-lg w-full z-10 max-h-60 overflow-auto">
                        {filteredRounds.map((r) => (
                            <button
                                key={r}
                                onClick={() => chooseRound(r)}
                                className={`block w-full text-left px-4 py-2 hover:bg-[hsl(var(--muted))]/30 ${r === selectedRound
                                        ? "font-semibold text-[hsl(var(--primary))]"
                                        : ""
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                        {filteredRounds.length === 0 && (
                            <div className="px-4 py-2 text-sm text-muted-foreground">
                                No rounds found.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedRound && (
                <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-[hsl(var(--border))]/60 text-[hsl(var(--primary))] bg-transparent text-sm">
                        {selectedRound}
                    </span>
                </div>
            )}

            {/* Records */}
            {selectedRound && (
                <section>
                    <h2 className="text-xl font-medium mb-3 text-center">{selectedRound}</h2>
                    {loading ? (
                        <p className="text-center text-muted-foreground">Loading records...</p>
                    ) : records.length === 0 ? (
                        <p className="text-center text-muted-foreground">
                            No records found for this round.
                        </p>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-4">
                            {records.map((r) => (
                                <motion.div
                                    key={r.id}
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.2 }}
                                    className="p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 rounded-xl shadow-sm hover:shadow-md"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-muted-foreground">
                                            {r.experience} • {r.category} • {r.bow_type}
                                        </span>
                                        <Trophy className="text-yellow-500" size={18} />
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                        {r.profiles?.avatar_url && (
                                            <img
                                                src={r.profiles.avatar_url}
                                                alt="avatar"
                                                className="w-10 h-10 rounded-full object-cover border border-[hsl(var(--border))]/40"
                                            />
                                        )}
                                        <div>
                                            <p className="text-3xl font-bold text-foreground">
                                                {r.score}
                                            </p>
                                            <p className="text-sm mt-1 text-muted-foreground">
                                                {r.profiles?.username || "Unknown Archer"}
                                            </p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">
                                                {new Date(r.score_date ?? r.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 text-xs"
                                        onClick={() => loadHistory(r)}
                                    >
                                        <Clock size={14} className="mr-1" /> View History
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* History Modal */}
            <AnimatePresence>
                {history && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setHistory(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="bg-[hsl(var(--card))] p-6 rounded-xl shadow-xl max-w-lg w-full text-center border border-[hsl(var(--border))]/40"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold mb-3 flex items-center justify-center gap-2">
                                <Clock className="text-blue-500" size={18} />
                                Record History
                            </h3>

                            {history.length === 0 && !activeRecord ? (
                                <p className="text-sm text-muted-foreground">
                                    No previous record history.
                                </p>
                            ) : (
                                <div className="relative mt-6 max-h-96 overflow-auto px-2 py-2">
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/20 transform -translate-x-1/2"></div>
                                    <div className="flex flex-col gap-10 items-center">

                                        {/* ✅ Current Top Record (added at the top) */}
                                        {activeRecord && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="relative flex flex-col items-center text-center"
                                            >
                                                <div className="w-16 h-16 rounded-full border-2 border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.4)] bg-background flex items-center justify-center z-10">
                                                    <img
                                                        src={activeRecord.profiles?.avatar_url || "/default-avatar.png"}
                                                        alt={activeRecord.profiles?.username || "Archer"}
                                                        className="w-14 h-14 rounded-full object-cover"
                                                    />
                                                </div>
                                                <div className="mt-3 p-3 bg-[hsl(var(--muted))]/30 rounded-lg border border-[hsl(var(--border))]/40 shadow-sm w-60">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {activeRecord.profiles?.username || "Unknown"}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Current record:{" "}
                                                        <span className="font-semibold text-[hsl(var(--primary))]">
                                                            {activeRecord.score}
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(activeRecord.score_date ?? activeRecord.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* 🕒 Previous records */}
                                            {history
                                                .filter((h) => h.new_score !== activeRecord?.score) // 🟢 remove current record from history
                                                .map((h, idx) => {
                                                const isCurrentRecord = h.new_score === activeRecord?.score;
                                                return (
                                                    <motion.div
                                                        key={h.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: (idx + 1) * 0.05 }}
                                                        className="relative flex flex-col items-center text-center"
                                                    >
                                                        <div
                                                            className={`w-14 h-14 rounded-full border-2 ${idx === 0 ? "border-blue-400" : "border-muted-foreground/40"
                                                                } bg-background flex items-center justify-center z-10`}
                                                        >
                                                            <img
                                                                src={h.profiles_new?.avatar_url || "/default-avatar.png"}
                                                                alt={h.profiles_new?.username || "Archer"}
                                                                className="w-12 h-12 rounded-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="mt-3 p-2 bg-[hsl(var(--muted))]/30 rounded-lg border border-[hsl(var(--border))]/40 shadow-sm w-56">
                                                            <p className="text-sm font-medium text-foreground">
                                                                {h.profiles_new?.username || "Unknown"}
                                                            </p>

                                                            {!isCurrentRecord ? (
                                                                <p className="text-sm text-muted-foreground">
                                                                    set a new record of{" "}
                                                                    <span className="font-semibold text-[hsl(var(--primary))]">
                                                                        {h.new_score}
                                                                    </span>
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">
                                                                    Current record:{" "}
                                                                    <span className="font-semibold text-[hsl(var(--primary))]">
                                                                        {h.new_score}
                                                                    </span>
                                                                </p>
                                                            )}

                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {new Date(h.changed_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            <Button className="mt-4" variant="secondary" onClick={() => setHistory(null)}>
                                Close
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}