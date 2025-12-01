"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Clock, BowArrow } from "lucide-react";

export default function SessionSignups() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [sessions, setSessions] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [clubId, setClubId] = useState<string | null>(null); // ✅ added
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [signups, setSignups] = useState<any[]>([]);
    const [showOlder, setShowOlder] = useState(false); // NEW

    const [currentProfile, setCurrentProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);

    useEffect(() => {
        async function fetchProfile() {
            if (!supabase) return;
            const { data } = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .eq("id", userId)
                .single();
            if (data) setCurrentProfile(data);
        }
        if (userId) fetchProfile();
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

            // ✅ fetch club_id and role
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
            .select(`
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
        profiles (username, avatar_url)
      )
    `)
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

        // 👂 Listen for sign-up / cancel changes in real time
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
    

    

    async function handleSignup(sessionId: string) {
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

        const { error } = await supabase
            .from("session_signups")
            .insert({ session_id: sessionId, user_id: userId });

        if (error) {
            console.error(error);
            toast.error("Error signing up.");
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
                                    is_coach: false, // or true for coach version
                                    profiles: {
                                        username: currentProfile?.username || "Unknown",
                                        avatar_url: currentProfile?.avatar_url || null,
                                    },
                                }
                            ],
                        }
                        : s
                )
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
            throw error; // <-- so we can catch it upstream
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
        }

        return true; // ✅ return to allow awaiting
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


        // Update local state instantly for smoother UX
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
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
                    <h1 className="text-2xl font-semibold">Club Membership Required</h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You need to be part of a club to access session signups. Please join or request to join a
                    club first from the main page.
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

    // ---------- NEW: split recent vs older-than-yesterday ----------
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
    // ---------------------------------------------------------------

    if (recentAndUpcoming.length === 0 && olderSessions.length === 0)
        return (
            <p className="text-center text-muted-foreground mt-10">
                No sessions found.
            </p>
        );

    const renderSessionCard = (s: any) => {
        const totalSignups = s.session_signups.filter((su: any) => !su.is_coach).length;
        const full = totalSignups >= s.capacity;
        const isSignedUp = s.session_signups.some((su: any) => su.user_id === userId);
        const sessionDate = new Date(s.session_date).toLocaleDateString();

        const signupIndex = s.session_signups.findIndex((su: any) => su.user_id === userId);
        const inWaitingList =
            signupIndex >= s.capacity &&
            !s.session_signups.find((su: any) => su.user_id === userId && su.is_coach);

        const hasConfirmedSpot = isSignedUp && signupIndex !== -1 && signupIndex < s.capacity;

        return (
            <Card
                key={s.id}
                className={`
        transition hover:shadow-md cursor-pointer
        ${s.cancelled ? "opacity-70" : ""}
        
        rounded-2xl
        border border-white/5
        bg-background/40 backdrop-blur-sm
        
        px-4 py-3         /* mobile padding */
        sm:px-6 sm:py-4   /* desktop stays spacious */
    `}
                onClick={() => openSignupDetails(s)}
            >
                <CardHeader className="pb-2 space-y-1 sm:space-y-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-base sm:text-lg font-semibold leading-tight">
                                {s.title}
                            </CardTitle>
                            <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                <span className="text-white font-medium text-sm sm:text-base">
                                    {new Date(s.session_date).toLocaleDateString(undefined, { weekday: "long" })}
                                </span>

                                <span className="text-muted-foreground text-xs sm:text-sm">
                                    {sessionDate} · {s.start_time}–{s.end_time}
                                </span>
                            </CardDescription>

                            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                                Capacity: {totalSignups}/{s.capacity}
                            </p>
                        </div>
                        {s.cancelled && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-md">
                                Cancelled
                            </span>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="mt-2 space-y-1.5 sm:space-y-2">
                    {s.cancelled ? (
                        <p className="text-sm text-red-500">
                            {s.cancellation_reason
                                ? `Reason: ${s.cancellation_reason}`
                                : "This session has been cancelled."}
                        </p>
                    ) : (
                        <>
                            {full && !isSignedUp && (
                                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={14} className="text-yellow-600" />
                                    This session is full — sign up to join the waiting list.
                                </p>
                            )}

                            {hasConfirmedSpot && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircle size={14} className="text-green-600" />
                                    You're going!
                                </p>
                            )}

                            {s.session_signups.some(
                                (su: any) => su.user_id === userId && su.is_coach
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

                            {inWaitingList && (
                                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                                    <Clock size={14} className="text-orange-500" />
                                    You’re currently on the waiting list.
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
                            {/* 🎯 Regular sign-up button */}
                            {!s.session_signups.some((su: any) => su.user_id === userId) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignup(s.id);
                                    }}
                                    className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1 text-sm hover:opacity-90"
                                >
                                    {full ? "Join Waiting List" : "Sign Up"}
                                </button>
                            )}


                            {/* 🧑‍🏫 Coach logic */}
                            {(userRole === "coach" || userRole === "admin") && (
                                <>
                                    {s.session_signups.some((su: any) => su.user_id === userId && su.is_coach) ? (
                                        <>
                                            {/* ✅ Currently coaching */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSwitchRole(s.id, false); // switch to archer
                                                }}
                                                className="rounded-md border px-3 py-1 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                            >
                                                Switch to Archer
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancel(s.id); // optional "Cancel Coaching" still available
                                                }}
                                                className="rounded-md border px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                            >
                                                Cancel Coaching
                                            </button>
                                        </>
                                    ) : s.session_signups.some((su: any) => su.user_id === userId && !su.is_coach) ? (
                                        <>
                                            {/* ✅ Currently signed up as an archer */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSwitchRole(s.id, true); // switch to coach
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
                                            {/* ✅ Not signed up yet */}
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
            {recentAndUpcoming.length > 0 && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    {recentAndUpcoming.map(renderSessionCard)}
                </div>
            )}

            {olderSessions.length > 0 && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowOlder((v) => !v)}
                        className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
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
                        className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-md"
                    >
                        <h3 className="text-lg font-semibold mb-2">{selectedSession.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                            <span className="text-white font-semibold text-base">
                                {new Date(selectedSession.session_date).toLocaleDateString(
                                    undefined,
                                    { weekday: "long" }
                                )}
                            </span>
                            <span>
                                {new Date(selectedSession.session_date).toLocaleDateString()} —{" "}
                                {selectedSession.start_time} to {selectedSession.end_time}
                            </span>
                        </p>

                        <p className="text-sm mb-4">
                            Capacity:{" "}
                            {selectedSession.session_signups?.filter((su: any) => !su.is_coach)
                                .length || 0}
                            /{selectedSession.capacity}
                        </p>

                        <h4 className="font-medium mb-2">Archers:</h4>
                        <ul className="max-h-48 overflow-y-auto border rounded-md p-2 text-sm space-y-1 mb-4">
                            {signups.filter((su) => !su.is_coach).length > 0 ? (
                                signups
                                    .filter((su) => !su.is_coach)
                                    .map((su, index, arr) => {
                                        const showDivider =
                                            index + 1 === selectedSession.capacity &&
                                            index + 1 < arr.length;
                                        return (
                                            <div key={su.user_id}>
                                                <a
                                                    href={`/profile/${su.user_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 hover:opacity-80 transition"
                                                >
                                                    {su.profiles?.avatar_url ? (
                                                        <img
                                                            src={su.profiles.avatar_url}
                                                            alt={su.profiles.username}
                                                            className="w-6 h-6 rounded-full object-cover border border-gray-300"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                                            ?
                                                        </div>
                                                    )}
                                                    <span>
                                                        <span className="font-semibold mr-1">#{index + 1}</span>
                                                        <span className="text-blue-600 hover:underline">
                                                            {su.profiles?.username || su.user_id}
                                                        </span>
                                                    </span>
                                                </a>
                                                {showDivider && (
                                                    <div className="border-t-2 border-red-500 my-1"></div>
                                                )}
                                            </div>
                                        );
                                    })
                            ) : (
                                <li className="text-muted-foreground text-sm">
                                    No players signed up yet
                                </li>
                            )}
                        </ul>

                        <h4 className="font-medium mb-2">Coaches:</h4>
                        <ul className="max-h-32 overflow-y-auto border rounded-md p-2 text-sm space-y-1">
                            {signups.filter((su) => su.is_coach).length > 0 ? (
                                signups
                                    .filter((su) => su.is_coach)
                                    .map((su) => (
                                        <li
                                            key={su.user_id}
                                            className="border-b py-1 px-2 flex justify-between text-gray-800 dark:text-gray-100 items-center"
                                        >
                                            <a
                                                href={`/profile/${su.user_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 hover:opacity-80 transition"
                                            >
                                                {su.profiles?.avatar_url ? (
                                                    <img
                                                        src={su.profiles.avatar_url}
                                                        alt={su.profiles.username}
                                                        className="w-6 h-6 rounded-full object-cover border border-gray-300"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600">
                                                        ?
                                                    </div>
                                                )}
                                                <span className="text-blue-600 hover:underline">
                                                    {su.profiles?.username || su.user_id}
                                                </span>
                                            </a>

                                            {su.user_id === userId ? (
                                                <span className="text-xs text-green-600 font-medium">You</span>
                                            ) : (
                                                <span className="text-xs text-blue-600 font-medium">Coach</span>
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
                            className="mt-4 bg-red-600 text-white w-full py-2 rounded-md"
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