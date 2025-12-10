"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Clock, BowArrow } from "lucide-react";

/* ------------------------------------------------------------------
   Time + occupancy helpers (pure functions)
------------------------------------------------------------------- */

type SignupLike = {
    user_id: string;
    is_coach: boolean;
    arrival_time?: string | null;
    departure_time?: string | null;
};

type SessionLike = {
    start_time: string;
    end_time: string;
    capacity: number;
    session_signups: SignupLike[];
};

function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    const h = parseInt(parts[0] || "0", 10);
    const m = parseInt(parts[1] || "0", 10);
    return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function buildBlocksForSession(
    session: SessionLike,
    blockMinutes = 30
): { start: number; end: number; count: number }[] {
    const start = timeToMinutes(session.start_time);
    const end = timeToMinutes(session.end_time);
    const blocks: { start: number; end: number; count: number }[] = [];

    for (let t = start; t < end; t += blockMinutes) {
        blocks.push({ start: t, end: t + blockMinutes, count: 0 });
    }

    return blocks;
}

function computeOccupancyBlocks(
    session: SessionLike,
    blockMinutes = 30
): { start: number; end: number; count: number }[] {
    const blocks = buildBlocksForSession(session, blockMinutes);
    const startMin = timeToMinutes(session.start_time);
    const endMin = timeToMinutes(session.end_time);

    for (const su of session.session_signups || []) {
        if (su.is_coach) continue; // coaches don't consume capacity

        const a = su.arrival_time ? timeToMinutes(su.arrival_time) : startMin;
        const d = su.departure_time ? timeToMinutes(su.departure_time) : endMin;

        for (const block of blocks) {
            if (a < block.end && block.start < d) {
                block.count += 1;
            }
        }
    }

    return blocks;
}

function canAttendInterval(
    session: SessionLike,
    arrival: string,
    departure: string,
    blockMinutes = 30
): boolean {
    const startMin = timeToMinutes(session.start_time);
    const endMin = timeToMinutes(session.end_time);
    const a = timeToMinutes(arrival);
    const d = timeToMinutes(departure);

    if (a >= d) return false;
    if (a < startMin || d > endMin) return false;

    const blocks = computeOccupancyBlocks(session, blockMinutes);

    for (const block of blocks) {
        if (a < block.end && block.start < d) {
            if (block.count >= session.capacity) {
                return false;
            }
        }
    }

    return true;
}

function generateTimeOptions(session: SessionLike | null, stepMinutes = 30): string[] {
    if (!session) return [];
    const start = timeToMinutes(session.start_time);
    const end = timeToMinutes(session.end_time);
    const opts: string[] = [];
    for (let t = start; t <= end; t += stepMinutes) {
        opts.push(minutesToTime(t));
    }
    return opts;
}

/* ------------------------------------------------------------------
   Component
------------------------------------------------------------------- */

export default function SessionSignups() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [sessions, setSessions] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [signups, setSignups] = useState<any[]>([]);
    const [showOlder, setShowOlder] = useState(false);
    

    const [currentProfile, setCurrentProfile] = useState<{
        username: string;
        avatar_url: string | null;
    } | null>(null);

    // partial–signup form state (in modal)
    const [partialStart, setPartialStart] = useState<string>("");
    const [partialEnd, setPartialEnd] = useState<string>("");

    useEffect(() => {
        // reset partial form when switching session
        setPartialStart("");
        setPartialEnd("");
    }, [selectedSession]);

    useEffect(() => {
        async function fetchProfile() {
            if (!supabase || !userId) return;
            const { data } = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .eq("id", userId)
                .single();
            if (data) setCurrentProfile(data);
        }
        fetchProfile();
    }, [supabase, userId]);

    useEffect(() => {
        async function loadData() {
            setLoading(true);

            const { data: session } = await supabase.auth.getSession();
            const currentUserId = session?.session?.user?.id || null;
            setUserId(currentUserId);

            if (!currentUserId) {
                setLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, club_id")
                .eq("id", currentUserId)
                .single();

            setUserRole(profile?.role || null);
            setClubId(profile?.club_id || null);

            setLoading(false);
        }

        loadData();
    }, [supabase]);

    useEffect(() => {
        if (!clubId) return;
        refreshSessions();
    }, [supabase, clubId]);

    async function refreshSessions() {
        setLoading(true);

        const { data, error } = await supabase
            .from("club_sessions")
            .select(
                `
      id,
      title,
      session_date,
      start_time,
      end_time,
      capacity,
      cancelled,
      cancellation_reason,
      club_id,
      session_signups (
        user_id,
        is_coach,
        created_at,
        arrival_time,
        departure_time,
        profiles (username, avatar_url)
      )
    `
            )
            .eq("club_id", clubId)
            .order("session_date", { ascending: true });

        if (error) {
            console.error("Error loading sessions:", error);
            toast.error("Failed to load sessions.");
        } else {
            setSessions(data || []);
        }

        setLoading(false);
    }

    useEffect(() => {
        if (!supabase || !clubId) return;

        const channel = supabase
            .channel("session_signups_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "session_signups" },
                () => {
                    console.log("Session signup changed — refreshing...");
                    refreshSessions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, clubId]);

    async function handleSignup(
        sessionId: string,
        arrivalTime?: string | null,
        departureTime?: string | null
    ) {
        if (!userId) {
            toast.error("You must be logged in to sign up.");
            return;
        }

        const session = sessions.find((s) => s.id === sessionId);
        if (!session) return;

        const alreadySignedUp = session.session_signups.some(
            (s: any) => s.user_id === userId
        );
        if (alreadySignedUp) {
            toast.info("You’re already signed up for this session.");
            return;
        }

        const startStr = session.start_time as string;
        const endStr = session.end_time as string;
        const arrival = arrivalTime ?? startStr;
        const departure = departureTime ?? endStr;

        // basic sanity
        if (timeToMinutes(arrival) >= timeToMinutes(departure)) {
            toast.error("End time must be after start time.");
            return;
        }

        if (
            timeToMinutes(arrival) < timeToMinutes(startStr) ||
            timeToMinutes(departure) > timeToMinutes(endStr)
        ) {
            toast.error("Selected time must be within the session hours.");
            return;
        }

        // capacity check using time-overlap
        const ok = canAttendInterval(session as SessionLike, arrival, departure, 30);
        if (!ok) {
            toast.error("That time slot is already full. Please pick another time.");
            return;
        }

        const isFullSession =
            arrival === startStr && departure === endStr;

        const { error } = await supabase.from("session_signups").insert({
            session_id: sessionId,
            user_id: userId,
            is_coach: false,
            arrival_time: isFullSession ? null : arrival,
            departure_time: isFullSession ? null : departure,
        });

        if (error) {
            console.error(error);
            toast.error("Error signing up.");
        } else {
            const username = currentProfile?.username || "Unknown";
            const avatar_url = currentProfile?.avatar_url || null;

            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            session_signups: [
                                ...s.session_signups,
                                {
                                    user_id: userId,
                                    is_coach: false,
                                    arrival_time: isFullSession ? null : arrival,
                                    departure_time: isFullSession ? null : departure,
                                    created_at: new Date().toISOString(),
                                    profiles: {
                                        username,
                                        avatar_url,
                                    },
                                },
                            ],
                        }
                        : s
                )
            );
            toast.success(
                isFullSession
                    ? "Signed up for the full session."
                    : "Signed up for that time slot."
            );
        }
    }

    async function handleCoachSignup(sessionId: string) {
        if (!userId) {
            toast.error("You must be logged in to sign up.");
            return;
        }

        const session = sessions.find((s) => s.id === sessionId);
        if (!session) return;

        const alreadyCoach = session.session_signups.some(
            (s: any) => s.user_id === userId && s.is_coach
        );
        if (alreadyCoach) {
            toast.info("You’re already signed up as a coach for this session.");
            return;
        }

        const { data: profileData } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", userId)
            .single();

        const username = profileData?.username || "Unknown";
        const avatar_url = profileData?.avatar_url || null;

        const { error } = await supabase
            .from("session_signups")
            .insert({ session_id: sessionId, user_id: userId, is_coach: true });

        if (error) {
            console.error(error);
            toast.error("Error signing up as coach.");
        } else {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            session_signups: [
                                ...s.session_signups,
                                {
                                    user_id: userId,
                                    is_coach: true,
                                    arrival_time: null,
                                    departure_time: null,
                                    created_at: new Date().toISOString(),
                                    profiles: { username, avatar_url },
                                },
                            ],
                        }
                        : s
                )
            );
        }
    }

    async function handleCancel(sessionId: string) {
        if (!userId) return;

        const { error } = await supabase
            .from("session_signups")
            .delete()
            .eq("session_id", sessionId)
            .eq("user_id", userId);

        if (error) {
            toast.error("Failed to cancel sign-up.");
            throw error;
        } else {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionId
                        ? {
                            ...s,
                            session_signups: s.session_signups.filter(
                                (su: any) => su.user_id !== userId
                            ),
                        }
                        : s
                )
            );
            toast.success("Sign-up cancelled.");
        }

        return true;
    }

    async function handleSwitchRole(sessionId: string, makeCoach: boolean) {
        if (!userId) return;

        const { error } = await supabase
            .from("session_signups")
            .update({ is_coach: makeCoach })
            .eq("session_id", sessionId)
            .eq("user_id", userId);

        if (error) {
            console.error(error);
            toast.error("Failed to switch role.");
            return;
        }

        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId
                    ? {
                        ...s,
                        session_signups: s.session_signups.map((su: any) =>
                            su.user_id === userId
                                ? { ...su, is_coach: makeCoach }
                                : su
                        ),
                    }
                    : s
            )
        );
    }

    function openSignupDetails(session: any) {
        setSelectedSession(session);
        const sortedSignups = [...(session.session_signups || [])].sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
        );
        setSignups(sortedSignups);
    }

    if (loading)
        return (
            <p className="text-center text-muted-foreground mt-10">
                Loading sessions...
            </p>
        );

    if (!clubId) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                    <BowArrow className="w-8 h-8" />
                    <h1 className="text-2xl font-semibold">
                        Club Membership Required
                    </h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You need to be part of a club to access session signups.
                    Please join or request to join a club first from the main
                    page.
                </p>
                <button
                    onClick={() => (window.location.href = "/")}
                    className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm hover:opacity-90"
                >
                    Join a club
                </button>
            </main>
        );
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cutoff = new Date(startOfToday);
    cutoff.setDate(cutoff.getDate() - 1);

    const olderSessions = sessions.filter(
        (s) => new Date(s.session_date) < cutoff
    );
    const recentAndUpcoming = sessions.filter(
        (s) => new Date(s.session_date) >= cutoff
    );

    if (recentAndUpcoming.length === 0 && olderSessions.length === 0)
        return (
            <p className="text-center text-muted-foreground mt-10">
                No sessions found.
            </p>
        );

    const renderSessionCard = (s: any) => {
        const totalArchers = s.session_signups.filter(
            (su: any) => !su.is_coach
        ).length;

        const blocks = computeOccupancyBlocks(s as SessionLike, 30);
        const maxBlockCount =
            blocks.length > 0
                ? blocks.reduce((m, b) => Math.max(m, b.count), 0)
                : 0;
        const allFull =
            blocks.length > 0 &&
            blocks.every((b) => b.count >= s.capacity);
        const someFull = blocks.some((b) => b.count >= s.capacity);

        const sessionDate = new Date(s.session_date).toLocaleDateString();

        const isSignedUp = s.session_signups.some(
            (su: any) => su.user_id === userId
        );

        const hasConfirmedSpot = isSignedUp; // with time-based capacity, if you're in, you have a spot

        return (
            <Card
                key={s.id}
                className={`
        cursor-pointer transition hover:shadow-lg hover:-translate-y-[1px]
        rounded-2xl border border-border/40
        bg-muted/30 backdrop-blur-sm
        px-5 py-4
    `}
                onClick={() => openSignupDetails(s)}
            >
                <CardHeader className="pb-2 space-y-1 sm:space-y-2">
                    <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                            <CardTitle className="text-lg font-semibold tracking-tight">
                                {s.title}
                            </CardTitle>

                            <CardDescription className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-white font-medium">
                                    {new Date(s.session_date).toLocaleDateString(undefined, { weekday: "long" })}
                                </span>
                                <span>
                                    {sessionDate} · {s.start_time}–{s.end_time}
                                </span>
                            </CardDescription>

                            <p className="text-xs text-muted-foreground/80">
                                Archers signed up: {totalArchers}  ·  Capacity: {s.capacity}
                            </p>
                        </div>

                        {s.cancelled && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400">
                                Cancelled
                            </span>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="mt-2 space-y-3">
                    {!s.cancelled && (
                        <>
                            {/* Availability Message */}
                            <div className="flex items-center gap-2 text-sm">
                                {allFull ? (
                                    <span className="flex items-center gap-1 text-red-500">
                                        <AlertTriangle size={15} /> All time slots full
                                    </span>
                                ) : someFull ? (
                                    <span className="flex items-center gap-1 text-yellow-500">
                                        <Clock size={15} /> Some slots full
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-green-500">
                                        <CheckCircle size={15} /> Plenty of space
                                    </span>
                                )}
                            </div>

                            {/* Time block bar */}
                            <div className="flex gap-1">
                                {blocks.map((b, i) => (
                                    <div
                                        key={i}
                                        className={`
                            h-2 w-4 rounded 
                            ${b.count >= s.capacity
                                                ? "bg-red-500"
                                                : b.count === 0
                                                    ? "bg-emerald-500"
                                                    : "bg-yellow-400"
                                            }
                        `}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {s.cancelled ? (
                        <p className="text-sm text-red-500 mt-1">
                            {s.cancellation_reason
                                ? `Reason: ${s.cancellation_reason}`
                                : "This session has been cancelled."}
                        </p>
                    ) : (
                        <>
                            {hasConfirmedSpot && (
                                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                    <CheckCircle
                                        size={14}
                                        className="text-green-600"
                                    />
                                    You're signed up for this session.
                                </p>
                            )}

                            {s.session_signups.some(
                                (su: any) =>
                                    su.user_id === userId && su.is_coach
                            ) && (
                                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                            className="text-blue-600"
                                        >
                                            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z" />
                                        </svg>
                                        You're coaching this session!
                                    </p>
                                )}
                        </>
                    )}
                </CardContent>

                <CardFooter
                    className="
        mt-2 
        flex flex-col sm:flex-row 
        gap-2 sm:gap-3 
        justify-end items-stretch sm:items-center
    "
                >
                    {!s.cancelled && (
                        <>
                            {/* Full-session signup button */}
                            {!isSignedUp && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignup(s.id, null, null);
                                    }}
                                    disabled={allFull}
                                    className={`
        px-4 py-2 rounded-xl text-sm font-medium
        bg-gradient-to-r from-emerald-600 to-sky-500 text-white
        hover:opacity-90 transition
        disabled:opacity-40
    `}
                                >
                                    {allFull ? "Session Full" : "Sign Up (Full Session)"}
                                </button>
                            )}

                            {/* Coaches */}
                            {(userRole === "coach" ||
                                userRole === "admin") && (
                                    <>
                                        {s.session_signups.some(
                                            (su: any) =>
                                                su.user_id === userId &&
                                                su.is_coach
                                        ) ? (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSwitchRole(
                                                            s.id,
                                                            false
                                                        );
                                                    }}
                                                    className="rounded-md border px-3 py-1 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                                >
                                                    Switch to Archer
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancel(s.id);
                                                    }}
                                                    className="rounded-md border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                >
                                                    Cancel Coaching
                                                </button>
                                            </>
                                        ) : s.session_signups.some(
                                            (su: any) =>
                                                su.user_id === userId &&
                                                !su.is_coach
                                        ) ? (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSwitchRole(
                                                            s.id,
                                                            true
                                                        );
                                                    }}
                                                    className="rounded-md border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                >
                                                    Switch to Coaching
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancel(s.id);
                                                    }}
                                                    className="rounded-md border px-3 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                >
                                                    Cancel Sign-up
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCoachSignup(s.id);
                                                    }}
                                                    className="rounded-md border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                >
                                                    Sign Up as Coach
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                        </>
                    )}
                </CardFooter>
            </Card>
        );
    };

    return (
        <section>

            {/* ▼ Gradient divider goes RIGHT HERE */}
            <div className="h-px w-full bg-gradient-to-r from-emerald-500/40 to-sky-500/40 my-6" />

            {recentAndUpcoming.length > 0 && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    {recentAndUpcoming.map(renderSessionCard)}
                </div>
            )}

            {olderSessions.length > 0 && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowOlder((v) => !v)}
                        className="rounded-xl border border-border/50 px-3 py-2 text-sm hover:bg-muted/40 transition"
                    >
                        {showOlder
                            ? "Hide older sessions"
                            : `Show older sessions (${olderSessions.length})`}
                    </button>

                    {showOlder && (
                        <div className="space-y-4 mt-3">
                            {olderSessions.map(renderSessionCard)}
                        </div>
                    )}
                </div>
            )}

            {selectedSession && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setSelectedSession(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="
        bg-background/80 backdrop-blur-xl 
        border border-border/50 
        rounded-2xl shadow-xl 
        p-6 w-[90%] max-w-md
        animate-in fade-in zoom-in-95
    "
                    >
                        <h3 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent mb-2">
                            {selectedSession.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                            <span className="text-white font-semibold text-base">
                                {new Date(
                                    selectedSession.session_date
                                ).toLocaleDateString(undefined, {
                                    weekday: "long",
                                })}
                            </span>
                            <span>
                                {new Date(
                                    selectedSession.session_date
                                ).toLocaleDateString()}{" "}
                                — {selectedSession.start_time} to{" "}
                                {selectedSession.end_time}
                            </span>
                        </p>

                        <p className="text-sm mb-4">
                            Archers:{" "}
                            {selectedSession.session_signups?.filter(
                                (su: any) => !su.is_coach
                            ).length || 0}
                            {" · Slot capacity: "}
                            {selectedSession.capacity}
                        </p>

                        {/* ---- Sign-up controls inside modal ---- */}
                        {!selectedSession.cancelled && (
                            <div className="mb-4 space-y-2">
                                <h4 className="font-medium text-sm">
                                    Sign up for this session
                                </h4>
                                <button
                                    className="
    w-full px-3 py-2 rounded-xl text-sm font-medium
    bg-gradient-to-r from-emerald-600 to-sky-500 text-white
    hover:opacity-90 transition
"                                    onClick={() =>
                                        handleSignup(
                                            selectedSession.id,
                                            null,
                                            null
                                        )
                                    }
                                >
                                    Full session (
                                    {selectedSession.start_time}–
                                    {selectedSession.end_time})
                                </button>

                                <div className="mt-2 space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Or choose a partial time:
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(() => {
                                            const opts =
                                                generateTimeOptions(
                                                    selectedSession,
                                                    30
                                                );
                                            return (
                                                <>
                                                    <select
                                                        value={partialStart}
                                                        onChange={(e) => setPartialStart(e.target.value)}
                                                        className="rounded-xl border border-border/50 bg-background px-2 py-1 text-sm"
                                                    >
                                                        <option value="">
                                                            Start
                                                        </option>
                                                        {opts.map((t) => (
                                                            <option
                                                                key={t}
                                                                value={t}
                                                            >
                                                                {t}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="text-xs">
                                                        to
                                                    </span>
                                                    <select
                                                        value={partialStart}
                                                        onChange={(e) => setPartialStart(e.target.value)}
                                                        className="rounded-xl border border-border/50 bg-background px-2 py-1 text-sm"
                                                    >
                                                        <option value="">
                                                            End
                                                        </option>
                                                        {opts.map((t) => (
                                                            <option
                                                                key={t}
                                                                value={t}
                                                            >
                                                                {t}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="px-3 py-1 rounded-xl border border-border/60 text-sm hover:bg-muted/40 disabled:opacity-40 transition"
                                                        disabled={
                                                            !partialStart ||
                                                            !partialEnd
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                !partialStart ||
                                                                !partialEnd
                                                            )
                                                                return;
                                                            handleSignup(
                                                                selectedSession.id,
                                                                partialStart,
                                                                partialEnd
                                                            );
                                                        }}
                                                    >
                                                        Sign up for this time
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ---- Full vs partial archers ---- */}
                        <h4 className="font-medium mb-1 text-sm">
                            Full-session archers:
                        </h4>
                        <ul className="max-h-40 overflow-y-auto border rounded-md p-2 text-sm space-y-1 mb-3">
                            {signups.filter(
                                (su) =>
                                    !su.is_coach &&
                                    !su.arrival_time &&
                                    !su.departure_time
                            ).length > 0 ? (
                                signups
                                    .filter(
                                        (su) =>
                                            !su.is_coach &&
                                            !su.arrival_time &&
                                            !su.departure_time
                                    )
                                    .map((su) => (
                                        <li
                                            key={su.user_id}
                                            className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-muted/30 transition"
                                        >
                                            <a
                                                href={`/profile/${su.user_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 hover:opacity-80 transition"
                                            >
                                                {su.profiles?.avatar_url ? (
                                                    <img
                                                        src={
                                                            su.profiles
                                                                .avatar_url
                                                        }
                                                        alt={
                                                            su.profiles
                                                                .username
                                                        }
                                                        className="w-6 h-6 rounded-full object-cover border border-gray-300"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                                        ?
                                                    </div>
                                                )}
                                                <span className="text-blue-600 hover:underline">
                                                    {su.profiles?.username ||
                                                        su.user_id}
                                                </span>
                                            </a>
                                        </li>
                                    ))
                            ) : (
                                <li className="text-muted-foreground text-sm">
                                    No full-session archers yet
                                </li>
                            )}
                        </ul>

                        <h4 className="font-medium mb-1 text-sm">
                            Partial-time archers:
                        </h4>
                        <ul className="max-h-40 overflow-y-auto border rounded-md p-2 text-sm space-y-1 mb-3">
                            {signups.filter(
                                (su) =>
                                    !su.is_coach &&
                                    (su.arrival_time || su.departure_time)
                            ).length > 0 ? (
                                signups
                                    .filter(
                                        (su) =>
                                            !su.is_coach &&
                                            (su.arrival_time ||
                                                su.departure_time)
                                    )
                                    .map((su) => (
                                        <li
                                            key={su.user_id}
                                            className="flex items-center gap-2"
                                        >
                                            <a
                                                href={`/profile/${su.user_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 hover:opacity-80 transition flex-1"
                                            >
                                                {su.profiles?.avatar_url ? (
                                                    <img
                                                        src={
                                                            su.profiles
                                                                .avatar_url
                                                        }
                                                        alt={
                                                            su.profiles
                                                                .username
                                                        }
                                                        className="w-6 h-6 rounded-full object-cover border border-gray-300"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                                        ?
                                                    </div>
                                                )}
                                                <span className="text-blue-600 hover:underline">
                                                    {su.profiles?.username ||
                                                        su.user_id}
                                                </span>
                                            </a>
                                            <span className="text-xs text-muted-foreground">
                                                {su.arrival_time || "?"}–
                                                {su.departure_time || "?"}
                                            </span>
                                        </li>
                                    ))
                            ) : (
                                <li className="text-muted-foreground text-sm">
                                    No partial-time archers yet
                                </li>
                            )}
                        </ul>

                        {/* Coaches unchanged, but listed below */}
                        <h4 className="font-medium mb-2 text-sm">Coaches:</h4>
                        <ul className="max-h-32 overflow-y-auto border rounded-md p-2 text-sm space-y-1">
                            {signups.filter((su) => su.is_coach).length > 0 ? (
                                signups
                                    .filter((su) => su.is_coach)
                                    .map((su) => (
                                        <li
                                            key={su.user_id}
                                            className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-muted/30 transition"
                                        >
                                            <a
                                                href={`/profile/${su.user_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 hover:opacity-80 transition"
                                            >
                                                {su.profiles?.avatar_url ? (
                                                    <img
                                                        src={
                                                            su.profiles
                                                                .avatar_url
                                                        }
                                                        alt={
                                                            su.profiles
                                                                .username
                                                        }
                                                        className="w-6 h-6 rounded-full object-cover border border-gray-300"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                                        ?
                                                    </div>
                                                )}
                                                <span className="text-blue-600 hover:underline">
                                                    {su.profiles?.username ||
                                                        su.user_id}
                                                </span>
                                            </a>

                                            {su.user_id === userId ? (
                                                <span className="text-xs text-green-600 font-medium">
                                                    You
                                                </span>
                                            ) : (
                                                <span className="text-xs text-blue-600 font-medium">
                                                    Coach
                                                </span>
                                            )}
                                        </li>
                                    ))
                            ) : (
                                <li className="text-muted-foreground text-sm">
                                    No coaches assigned yet
                                </li>
                            )}
                        </ul>

                        <button
                            className="mt-4 w-full py-2 rounded-xl bg-red-600 text-white hover:opacity-90 transition"
                            onClick={() => setSelectedSession(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}