"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Target, Calendar, Activity } from "lucide-react";
import BowTypeTag from "@/components/BowTypeTag";
import { Sparkles } from "lucide-react";

type ClubPost = {
    id: string;
    round_name: string;
    score: number;
    score_type: string | null;
    score_date: string | null;
    created_at: string;
    is_personal_best: boolean | null;
    category: string | null;
    bow_type: string | null;
    competition_name: string | null;
    spot_type: string | null;
};

export default function ProfileViewClient({ userId }: { userId?: string }) {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [viewer, setViewer] = useState<any>(null);
    const [club, setClub] = useState<any>(null);
    const [scores, setScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedScore, setSelectedScore] = useState<any | null>(null);
    const metric = "handicap";
    const [filter, setFilter] = useState<"all" | "indoor" | "outdoor">("all");
    const [eventLines, setEventLines] = useState<{ date: string; label: string }[]>([]);
    const [showAddLineModal, setShowAddLineModal] = useState(false);
    const [newLineDate, setNewLineDate] = useState("");
    const [newLineLabel, setNewLineLabel] = useState("");
    const EVENT_DOT_RADIUS = 10;
    const [hoveringEvent, setHoveringEvent] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editLineDate, setEditLineDate] = useState("");
    const [editLineLabel, setEditLineLabel] = useState("");
    


    // 🔄 Load persisted event lines from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("eventLines");
        if (saved) {
            try {
                setEventLines(JSON.parse(saved));
            } catch {
                console.warn("Failed to parse saved event lines");
            }
        }
    }, []);

    // 💾 Save event lines whenever they change
    useEffect(() => {
        localStorage.setItem("eventLines", JSON.stringify(eventLines));
    }, [eventLines]);


    useEffect(() => {
        async function loadData() {
            const { data: session } = await supabase.auth.getSession();
            const sessionUser = session?.session?.user;

            if (!sessionUser && !userId) {
                window.location.href = "/login";
                return;
            }

            const viewedUserId = userId || sessionUser!.id;
            setUser(sessionUser);

            // Load viewer profile
            const { data: viewerProfile } = await supabase
                .from("profiles")
                .select("id, role, club_id")
                .eq("id", sessionUser?.id)
                .maybeSingle();

            // Attach email from Auth (since profiles doesn't store it)
            const viewerData = {
                ...viewerProfile,
                email: sessionUser?.email || null,
            };

            setViewer(viewerData);

            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select(
                    "id, username, avatar_url, bow_type, category, experience, club_id, created_at, role, agb_number"
                )
                .eq("id", viewedUserId)
                .single();

            if (profileError) toast.error("Error loading profile");
            setProfile(profileData);

            if (profileData?.club_id) {
                const { data: clubData } = await supabase
                    .from("clubs")
                    .select("name")
                    .eq("id", profileData.club_id)
                    .single();
                setClub(clubData);
            }

            const { data: postData, error } = await supabase
                .from("club_posts")
                .select(
                    "id, round_name, score, score_type, score_date, created_at, is_personal_best, category, bow_type, competition_name, spot_type"
                )
                .eq("user_id", viewedUserId)
                .order("score_date", { ascending: true })
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error loading club posts:", error);
            }

            const normalizedScores = await Promise.all(
                (postData || []).map(async (p: ClubPost) => {
                    const isOutdoor = p.score_type?.toLowerCase().includes("outdoor");
                    const bowType = p.bow_type || profileData?.bow_type || "recurve";
                    const bowGroup = bowType === "compound" ? "compound" : "non-compound";

                    const rawSpot = p.spot_type?.toLowerCase().trim() || "";
                    const spotType =
                        rawSpot.includes("triple")
                            ? "triple"
                            : rawSpot.includes("3spot")
                                ? "triple"
                                : rawSpot.includes("single") || rawSpot.includes("full")
                                    ? "full size"
                                    : null;

                    let query = supabase
                        .from("handicaps")
                        .select("handicap")
                        .eq("round_name", p.round_name)
                        .eq("bow_group", bowGroup)
                        .lte("score", p.score)
                        .order("score", { ascending: false })
                        .limit(1);

                    if (spotType && spotType !== "full size") {
                        query = query.ilike("spot_type", `%${spotType}%`);
                    }

                    const { data: handicapData } = await query.maybeSingle();

                    return {
                        ...p,
                        is_outdoor: isOutdoor,
                        handicap: handicapData?.handicap ?? null,
                        date: p.score_date
                            ? new Date(p.score_date).getTime()
                            : p.created_at
                                ? new Date(p.created_at).getTime()
                                : null,
                        created_at: p.created_at || null,
                    };
                })
            );

            setScores(normalizedScores);
            setLoading(false);
        }

        loadData();
    }, [supabase, userId]);

    async function changeRole(nextRole: "member" | "coach" | "admin") {
        if (!profile?.id) return;

        const { error } = await supabase
            .from("profiles")
            .update({ role: nextRole })
            .eq("id", profile.id);

        if (error) {
            toast.error(error.message || "Failed to update role");
        } else {
            toast.success(`Role updated to ${nextRole}`);
            setProfile((p: any) => (p ? { ...p, role: nextRole } : p));
        }
    }

    const totalScores = scores.length;
    const totalPoints = scores.reduce((acc, s) => acc + (s.score || 0), 0);
    const indoorScores = scores.filter((s) => !s.is_outdoor);
    const outdoorScores = scores.filter((s) => s.is_outdoor);

    const personalBests = scores.reduce((bests, s) => {
        if (!bests[s.round_name] || s.score > bests[s.round_name].score)
            bests[s.round_name] = s;
        return bests;
    }, {} as Record<string, any>);

    const canManage =
        !!viewer &&
        viewer.role === "admin" &&
        viewer.club_id === profile?.club_id &&
        viewer.id !== profile?.id;

    /** --- AUTOSCALE DOMAINS (points + event lines) --- */
    const visibleScores = useMemo(() => {
        const arr = [
            ...(filter !== "outdoor" ? indoorScores : []),
            ...(filter !== "indoor" ? outdoorScores : []),
        ];
        return arr.filter(
            (s) => typeof s.date === "number" && Number.isFinite(s.handicap)
        );
    }, [filter, indoorScores, outdoorScores]);

    const xDomain: [number, number] = useMemo(() => {
        if (visibleScores.length === 0 && eventLines.length === 0) {
            const today = Date.now();
            return [today - 86400000, today + 86400000]; // fallback: ±1 day
        }
        const xs = visibleScores.map((s) => s.date as number);
        const eventXs = eventLines.map((e) => new Date(e.date).getTime());
        const minX = Math.min(
            ...(xs.length ? xs : [Infinity]),
            ...(eventXs.length ? eventXs : [Infinity])
        );
        const maxX = Math.max(
            ...(xs.length ? xs : [-Infinity]),
            ...(eventXs.length ? eventXs : [-Infinity])
        );
        const pad = Math.max(86400000, Math.round((maxX - minX) * 0.05)); // ≥1 day or 5%
        return [minX - pad, maxX + pad];
    }, [visibleScores, eventLines]);

    const yDomain: [number, number] = useMemo(() => {
        if (visibleScores.length === 0) return [0, 1];
        const ys = visibleScores.map((s) => s.handicap as number);
        const maxY = Math.max(...ys);
        const pad = Math.max(1, Math.round(Math.max(1, maxY) * 0.1));
        return [0, Math.max(1, maxY + pad)];
    }, [visibleScores]);

    const xTicks = useMemo(() => {
        const [min, max] = xDomain;
        if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;

        const span = Math.max(1, max - min);
        const day = 24 * 60 * 60 * 1000;

        // Aim for ~6 ticks, on whole-day boundaries
        const idealCount = 6;
        const stepRaw = Math.max(day, Math.round(span / idealCount));
        const step = Math.max(day, Math.round(stepRaw / day) * day) || day;

        // Start on a step boundary
        const start = Math.floor(min / step) * step;

        const values: number[] = [];
        for (let t = start; t <= max; t += step) values.push(t);

        // Ensure endpoints are included
        if (values.length === 0 || values[0] > min) values.unshift(min);
        if (values[values.length - 1] < max) values.push(max);

        // De-duplicate + sort (important!)
        return Array.from(new Set(values)).sort((a, b) => a - b);
    }, [xDomain]);

    // Number of invisible hover points per vertical event line
    const EVENT_HIT_DOTS_PER_LINE = 24;

    const eventHitData = useMemo(() => {
        const [y0, y1] = yDomain;
        const n = EVENT_HIT_DOTS_PER_LINE;
        if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= y0) return [];

        // Evenly spaced Y positions across the visible Y domain
        const ys = Array.from({ length: n }, (_, i) => y0 + ((i + 0.5) / n) * (y1 - y0));

        return eventLines.flatMap((e) => {
            const x = new Date(e.date).getTime();
            return ys.map((y, i) => ({
                date: x,
                handicap: y,
                label: e.label,
                __event: true as const,
                __k: `${x}-${i}`, // stable key for shape
            }));
        });
    }, [eventLines, yDomain]);

    if (loading)
        return (
            <p className="text-center text-muted-foreground mt-10">Loading profile...</p>
        );

    

    function CustomTooltip({ active, payload }: any) {
        if (!active || !payload?.length) return null;
        const p = payload[0]?.payload;

        // If it's one of our event hover points
        if (p && p.__event) {
            return (
                <div className="p-2 bg-white dark:bg-neutral-900 border rounded-md shadow-md text-xs space-y-1">
                    <p>{p.label}</p>
                    <p className="text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                        })}
                    </p>
                </div>
            );
        }

        // Default (score point) tooltip
        if (!p) return null;
        return (
            <div className="p-3 bg-white dark:bg-neutral-900 border rounded-lg shadow-md text-sm space-y-1">
                <p className="font-semibold">{p.round_name}</p>
                <p className="flex items-center gap-1">
                    <Target className="w-4 h-4" /> Score: {p.score}
                </p>
                <p className="flex items-center gap-1">Handicap: {p.handicap ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                    Spot: {p.spot_type === "triple" ? "Triple Spot" : "Full Size"}
                </p>
                <p className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />{" "}
                    {new Date(p.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                    })}
                </p>
                <p className="flex items-center gap-1">
                    <Activity className="w-4 h-4" /> {p.is_outdoor ? "Outdoor" : "Indoor"}
                </p>
            </div>
        );
    }
    
    return (
        <main className="max-w-5xl mx-auto p-6 space-y-6">
            {/* Profile Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="flex flex-col md:flex-row items-center gap-6 p-6 shadow-md">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-[hsl(var(--primary))]/30">
                        <Image
                            src={profile?.avatar_url || "/default-avatar.png"}
                            alt="Profile Picture"
                            fill
                            sizes="96px"
                            className="object-cover"
                            loading="eager"
                            priority
                        />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-2xl font-bold">{profile?.username}</h1>
                        <p className="text-sm text-muted-foreground">
                            {profile?.category || "Uncategorised"} · {club?.name || "No club"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Joined {new Date(profile?.created_at).toLocaleDateString()}
                        </p>
                        {profile?.role && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Role: <span className="font-medium">{profile.role}</span>
                            </p>

                        )}

                        {profile?.bow_type && (
                            <div className="mt-2">
                                <BowTypeTag bow={profile.bow_type} />
                            </div>
                        )}


                        {(viewer?.role === "admin" || viewer?.id === profile?.id) && profile?.agb_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                                <strong>AGB:</strong> {profile.agb_number}
                            </p>
                        )}

                        

                        {viewer?.email === "u2102807@live.warwick.ac.uk" && (
                            <div
                                className="
            relative inline-flex items-center gap-2 mt-2 px-4 py-1.5
            text-xs font-semibold text-white
            backdrop-blur-md rounded-full
            bg-white/10 border border-purple-300/20
            shadow-[0_0_12px_rgba(168,85,247,0.6)]
            overflow-hidden
        "
                            >
                                {/* Icon */}
                                <Sparkles className="w-4 h-4 text-purple-200 drop-shadow-[0_0_6px_rgba(168,85,247,0.9)] animate-pulse" />

                                {/* Text */}
                                <span className="drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]">
                                    Developer
                                </span>

                                {/* Permanent purple outer glow */}
                                <div
                                    className="
                absolute inset-0 rounded-full
                bg-purple-500/40 blur-xl opacity-60
                animate-[pulse_3s_ease-in-out_infinite]
                pointer-events-none
            "
                                ></div>

                                {/* Glass shine overlay */}
                                <div
                                    className="
                absolute inset-0 rounded-full
                bg-gradient-to-br from-white/10 to-transparent
                mix-blend-overlay pointer-events-none
            "
                                ></div>

                                {/* 🔥 Shimmer effect */}
                                <div
                                    className="
                absolute inset-0 rounded-full
                bg-gradient-to-r from-transparent via-white/40 to-transparent
                opacity-40 blur-md
                animate-[shimmer_2.5s_linear_infinite]
                pointer-events-none
            "
                                ></div>

                                {/* Keyframes for shimmer */}
                                <style jsx>{`
            @keyframes shimmer {
                0% {
                    transform: translateX(-150%);
                }
                50% {
                    transform: translateX(150%);
                }
                100% {
                    transform: translateX(150%);
                }
            }
        `}</style>
                            </div>
                        )}
                    </div>

                    {(!userId || user?.id === userId) && (
                        <Link href="/profile/edit">
                            <Button>Edit Profile</Button>
                        </Link>
                    )}

                    {canManage && (
                        <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                            <Button variant="outline" size="sm" onClick={() => changeRole("coach")}>
                                Make Coach
                            </Button>

                            <Button variant="outline" size="sm" onClick={() => changeRole("admin")}>
                                Make Admin
                            </Button>

                            {profile?.role !== "member" && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => changeRole("member")}
                                >
                                    Remove Role
                                </Button>
                            )}

                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                    const confirmRemove = window.confirm(
                                        `Remove ${profile?.username}?`
                                    );
                                    if (!confirmRemove) return;

                                    const { error } = await supabase
                                        .from("profiles")
                                        .update({ club_id: null })
                                        .eq("id", profile.id);

                                    if (error) toast.error("Failed");
                                    else toast.success("Member removed");
                                }}
                            >
                                Remove from Club
                            </Button>
                        </div>
                    )}

                </Card>
            </motion.div>

            {/* Stats */}
            <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="text-center py-4">
                    <CardTitle className="text-sm text-muted-foreground">
                        Total Scores
                    </CardTitle>
                    <CardContent className="text-2xl font-bold">{totalScores}</CardContent>
                </Card>
                <Card className="text-center py-4">
                    <CardTitle className="text-sm text-muted-foreground">
                        Total Points
                    </CardTitle>
                    <CardContent className="text-2xl font-bold">{totalPoints}</CardContent>
                </Card>
            </motion.div>

            {/* Tabs */}
            <Tabs defaultValue="graph" className="w-full">
                <TabsList className="flex justify-center gap-4 mb-4">
                    <TabsTrigger value="graph">Performance Graph</TabsTrigger>
                    <TabsTrigger value="recent">Recent Scores</TabsTrigger>
                    <TabsTrigger value="bests">Personal Bests</TabsTrigger>
                </TabsList>

                {/* Graph Tab */}
                <TabsContent value="graph">
                    {scores.length === 0 ? (
                        <p className="text-center text-muted-foreground">No scores yet.</p>
                    ) : (
                        <Card className="p-6 space-y-4">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold">Performance Over Time</h2>

                                    <div className="flex items-center gap-2 flex-wrap justify-center">
                                        <Button variant="outline" size="sm" onClick={() => setShowAddLineModal(true)}>
                                            + Add/Edit Event Line
                                        </Button>

                                        <div className="flex bg-muted rounded-full p-1">
                                            <Button
                                                size="sm"
                                                variant={filter === "all" ? "default" : "ghost"}
                                                onClick={() => setFilter("all")}
                                            >
                                                All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={filter === "indoor" ? "default" : "ghost"}
                                                onClick={() => setFilter("indoor")}
                                            >
                                                Indoor
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={filter === "outdoor" ? "default" : "ghost"}
                                                onClick={() => setFilter("outdoor")}
                                            >
                                                Outdoor
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={`${metric}-${filter}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <ResponsiveContainer width="100%" height={420}>
                                        <ScatterChart
                                            margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                                        >
                                                <XAxis
                                                    dataKey="date"
                                                    type="number"
                                                    scale="time"
                                                    domain={xDomain}
                                                    ticks={xTicks}                 // <- custom, de-duplicated ticks
                                                    minTickGap={12}                // let Recharts hide overlapping labels if needed
                                                    tickFormatter={(d) =>
                                                        d ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : ""
                                                    }
                                                    name="Date"
                                                    tick={{ fontSize: 12 }}
                                                />
                                                <YAxis
                                                    dataKey="handicap"
                                                    name="Handicap"
                                                    domain={yDomain}
                                                    allowDecimals={false}
                                                    label={{
                                                        value: "Handicap ↓",
                                                        angle: -90,
                                                        position: "insideLeft",
                                                        style: { textAnchor: "middle", fontSize: 13 },
                                                    }}
                                                    tick={{ fontSize: 12 }}
                                                />

                                                <Tooltip
                                                    cursor={hoveringEvent ? false : { strokeDasharray: "3 3" }}
                                                    content={<CustomTooltip />}
                                                    allowEscapeViewBox={{ x: true, y: true }}
                                                    wrapperStyle={{ pointerEvents: "none" }}
                                                />

                                                {/* Invisible scatter forming a vertical hover “hit strip” for each event line */}
                                                <Scatter
                                                    name="Events"
                                                    data={eventHitData}
                                                    legendType="none"
                                                    isAnimationActive={false}
                                                    onMouseEnter={() => setHoveringEvent(true)}
                                                    onMouseLeave={() => setHoveringEvent(false)}
                                                    shape={({ cx, cy, payload }: any) => (
                                                        <circle
                                                            key={payload?.__k}
                                                            cx={cx}
                                                            cy={cy}
                                                            r={18}
                                                            fill="rgba(0,0,0,0.001)"
                                                            stroke="none"
                                                        />
                                                    )}
                                                />

                                                {eventLines.map((event) => (
                                                    <ReferenceLine
                                                        key={event.date + event.label}
                                                        x={new Date(event.date).getTime()}
                                                        stroke="hsl(var(--primary))"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={3}
                                                        ifOverflow="extendDomain"
                                                    />
                                                ))}

                                            <Legend verticalAlign="top" align="center" />

                                            {filter !== "outdoor" && (
                                                    <Scatter
                                                        name="Indoor"
                                                        data={indoorScores}
                                                        fill="#ff4b4b"
                                                        r={6}
                                                        onMouseEnter={() => setHoveringEvent(false)}
                                                        onClick={(data) => setSelectedScore(data)}
                                                    />
                                            )}
                                            {filter !== "indoor" && (
                                                    <Scatter
                                                        name="Outdoor"
                                                        data={outdoorScores}
                                                        fill="#2b9aff"
                                                        r={6}
                                                        onMouseEnter={() => setHoveringEvent(false)}
                                                        onClick={(data) => setSelectedScore(data)}
                                                    />
                                            )}
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            </AnimatePresence>
                        </Card>
                    )}
                </TabsContent>

                {/* 🕒 Recent Scores Tab */}
                <TabsContent value="recent">
                    {scores.length === 0 ? (
                        <p className="text-center text-muted-foreground">No scores yet.</p>
                    ) : (
                        <Card className="p-4 space-y-2">
                            <h2 className="text-lg font-semibold mb-2">Recent Scores</h2>
                            <div className="divide-y divide-[hsl(var(--border))]/40">
                                {scores
                                    .slice()
                                    .sort((a, b) => {
                                        const dateA = new Date(
                                            a.score_date || a.created_at || 0
                                        ).getTime();
                                        const dateB = new Date(
                                            b.score_date || b.created_at || 0
                                        ).getTime();

                                        if (dateA === dateB) {
                                            return (
                                                new Date(b.created_at || 0).getTime() -
                                                new Date(a.created_at || 0).getTime()
                                            );
                                        }

                                        return dateB - dateA;
                                    })
                                    .slice(0, 10)
                                    .map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedScore(s)}
                                            className="w-full text-left py-2 flex justify-between items-center hover:bg-[hsl(var(--muted))]/30 transition rounded-md px-2"
                                        >
                                            <div>
                                                <p className="font-medium">{s.round_name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(s.score_date).toLocaleDateString()} ·{" "}
                                                    {s.is_outdoor ? "Outdoor" : "Indoor"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">{s.score}</p>
                                                {s.handicap !== null && s.handicap !== undefined && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Handicap: {s.handicap}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </Card>
                    )}
                </TabsContent>

                {/* 🏆 Personal Bests Tab */}
                <TabsContent value="bests">
                    {Object.keys(personalBests).length === 0 ? (
                        <p className="text-center text-muted-foreground">
                            No personal bests yet.
                        </p>
                    ) : (
                        <Card className="p-4 space-y-2">
                            <h2 className="text-lg font-semibold mb-2">Personal Bests</h2>
                            <div className="divide-y divide-[hsl(var(--border))]/40">
                                {Object.values(personalBests)
                                    .sort((a: any, b: any) => b.score - a.score)
                                    .map((s: any) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedScore(s)}
                                            className="w-full text-left py-2 flex justify-between items-center hover:bg-[hsl(var(--muted))]/30 transition rounded-md px-2"
                                        >
                                            <div>
                                                <p className="font-medium">{s.round_name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(s.score_date).toLocaleDateString()} ·{" "}
                                                    {s.is_outdoor ? "Outdoor" : "Indoor"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">{s.score}</p>
                                                {s.handicap !== null && s.handicap !== undefined && (
                                                    <p className="text-xs text-muted-foreground">
                                                       Handicap: {s.handicap}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </Card>
                    )}
                </TabsContent>

                {/* Popup Modal */}
                {selectedScore && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setSelectedScore(null)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-sm"
                        >
                            <h3 className="text-lg font-semibold mb-2">
                                {selectedScore.round_name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                {new Date(selectedScore.date).toLocaleDateString()}
                            </p>
                            <p className="text-sm">
                                <strong>Score:</strong> {selectedScore.score}
                            </p>
                            <p className="text-sm">
                                <strong>Handicap:</strong> {selectedScore.handicap ?? "—"}
                            </p>
                            <p className="text-sm">
                                <strong>Spot:</strong>{" "}
                                {selectedScore.spot_type === "triple"
                                    ? "Triple Spot"
                                    : "Full Size"}
                            </p>
                            <p className="text-sm">
                                <strong>Type:</strong>{" "}
                                {selectedScore.is_outdoor ? "Outdoor" : "Indoor"}
                            </p>
                            {selectedScore.competition_name && (
                                <p className="text-sm">
                                    <strong>Competition:</strong>{" "}
                                    {selectedScore.competition_name}
                                </p>
                            )}
                            <button
                                className="mt-4 bg-red-600 text-white w-full py-2 rounded-md"
                                onClick={() => setSelectedScore(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Tabs>

            {/* 🟡 Add / Manage Event Lines Modal */}
            {showAddLineModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-sm space-y-4">
                        <h3 className="text-lg font-semibold text-center">Manage Event Lines</h3>

                        {/* Add new line section */}
                        <div className="space-y-2 border-b border-[hsl(var(--border))]/50 pb-4">
                            <label className="text-sm font-medium block">Date</label>
                            <input
                                type="date"
                                value={newLineDate}
                                onChange={(e) => setNewLineDate(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />

                            <label className="text-sm font-medium block mt-2">Label</label>
                            <input
                                type="text"
                                value={newLineLabel}
                                onChange={(e) => setNewLineLabel(e.target.value)}
                                placeholder="e.g. Form change, New equipment..."
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            />

                            <Button
                                className="w-full mt-3"
                                onClick={() => {
                                    if (!newLineDate || !newLineLabel) {
                                        toast.error("Please enter both a date and a label.");
                                        return;
                                    }
                                    const exists = eventLines.some((e) => e.date === newLineDate && e.label === newLineLabel);
                                    if (exists) {
                                        toast.error("That event line already exists.");
                                        return;
                                    }
                                    setEventLines((prev) => [...prev, { date: newLineDate, label: newLineLabel }]);
                                    setNewLineDate("");
                                    setNewLineLabel("");
                                }}
                            >
                                + Add Line
                            </Button>
                        </div>

                    
                        {/* List existing lines */}
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {eventLines.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center">No event lines yet.</p>
                            ) : (
                                eventLines.map((line, i) => (
                                    <div
                                        key={`${line.date}-${line.label}-${i}`}
                                        className="flex flex-col gap-2 border rounded-md px-3 py-2 text-sm"
                                    >
                                        {editingIndex === i ? (
                                            // --- Inline editor ---
                                            <div className="grid gap-2 md:grid-cols-3">
                                                <input
                                                    type="date"
                                                    value={editLineDate}
                                                    onChange={(e) => setEditLineDate(e.target.value)}
                                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    value={editLineLabel}
                                                    onChange={(e) => setEditLineLabel(e.target.value)}
                                                    placeholder="Label"
                                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                                />
                                                <div className="flex items-center gap-2 md:justify-end">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            if (!editLineDate || !editLineLabel) {
                                                                toast.error("Please enter both a date and a label.");
                                                                return;
                                                            }
                                                            const dupe = eventLines.some(
                                                                (e, idx) =>
                                                                    idx !== i &&
                                                                    e.date === editLineDate &&
                                                                    e.label === editLineLabel
                                                            );
                                                            if (dupe) {
                                                                toast.error("That event line already exists.");
                                                                return;
                                                            }
                                                            setEventLines((prev) =>
                                                                prev.map((e, idx) =>
                                                                    idx === i ? { date: editLineDate, label: editLineLabel } : e
                                                                )
                                                            );
                                                            setEditingIndex(null);
                                                            setEditLineDate("");
                                                            setEditLineLabel("");
                                                            toast.success("Event line updated.");
                                                        }}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setEditingIndex(null);
                                                            setEditLineDate("");
                                                            setEditLineLabel("");
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            // --- Read-only row with Edit & Delete ---
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{line.label}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(line.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setEditingIndex(i);
                                                            setEditLineDate(line.date);
                                                            setEditLineLabel(line.label);
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEventLines((prev) => prev.filter((_, index) => index !== i));
                                                            // if you were editing this one, reset editor state
                                                            if (editingIndex === i) {
                                                                setEditingIndex(null);
                                                                setEditLineDate("");
                                                                setEditLineLabel("");
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button variant="outline" onClick={() => setShowAddLineModal(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}