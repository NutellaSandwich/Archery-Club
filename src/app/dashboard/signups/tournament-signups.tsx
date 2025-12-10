"use client";

import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { toast } from "sonner";

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { BowArrow } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------
   Tournament Signups Page — FULL UI OVERHAUL
------------------------------------------------ */

export default function TournamentSignups() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [clubId, setClubId] = useState<string | null>(null);
    const [showOlder, setShowOlder] = useState(false);

    /* ---------------------------------------
       Load tournaments
    --------------------------------------- */
    async function loadData() {
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id || null;
            setUserId(currentUserId);

            if (!currentUserId) {
                setLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", currentUserId)
                .single();

            setClubId(profile?.club_id || null);

            if (!profile?.club_id) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("club_tournaments")
                .select(`
                    id,
                    title,
                    event_date,
                    signup_close_at,
                    max_signups,
                    tournament_signups:tournament_signups_tournament_id_fkey (
                        user_id,
                        profiles (username)
                    )
                `)
                .order("event_date", { ascending: true });

            if (error) {
                console.error("Error loading tournaments:", error);
                toast.error("Failed to load tournaments.");
            } else {
                setTournaments(data || []);
            }
        } catch (err) {
            console.error("Unexpected error loading tournaments:", err);
            toast.error("Something went wrong.");
        }

        setLoading(false);
    }

    useEffect(() => {
        loadData();

        let realtimeTimer: any;

        const channel = supabase
            .channel("realtime_tournament_signups")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tournament_signups" },
                () => {
                    clearTimeout(realtimeTimer);
                    realtimeTimer = setTimeout(() => loadData(), 400);
                }
            )
            .subscribe();

        return () => {
            clearTimeout(realtimeTimer);
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    /* ---------------------------------------
       Sign up / Cancel
    --------------------------------------- */
    async function handleSignup(tournamentId: string) {
        if (!userId) {
            toast.error("You must be logged in to sign up.");
            return;
        }

        const tournament = tournaments.find((t) => t.id === tournamentId);
        if (!tournament) return;

        if (
            tournament.signup_close_at &&
            new Date(tournament.signup_close_at) < new Date()
        ) {
            toast.error("Sign-ups for this tournament have closed.");
            return;
        }

        const alreadySignedUp = tournament.tournament_signups.some(
            (s: any) => s.user_id === userId
        );
        if (alreadySignedUp) {
            toast.info("You're already signed up.");
            return;
        }

        // Optimistic UI
        setTournaments((prev) =>
            prev.map((t) =>
                t.id === tournamentId
                    ? {
                        ...t,
                        tournament_signups: [
                            ...t.tournament_signups,
                            { user_id: userId, profiles: { username: "You" } },
                        ],
                    }
                    : t
            )
        );

        const { error } = await supabase
            .from("tournament_signups")
            .insert([{ tournament_id: tournamentId, user_id: userId }]);

        if (error) {
            toast.error("Error signing up.");
            loadData(); // rollback
        } else {
            toast.success("Signed up!");
        }
    }

    async function handleCancel(tournamentId: string) {
        if (!userId) return;

        setTournaments((prev) =>
            prev.map((t) =>
                t.id === tournamentId
                    ? {
                        ...t,
                        tournament_signups: t.tournament_signups.filter(
                            (s: any) => s.user_id !== userId
                        ),
                    }
                    : t
            )
        );

        const { error } = await supabase
            .from("tournament_signups")
            .delete()
            .eq("tournament_id", tournamentId)
            .eq("user_id", userId);

        if (error) {
            toast.error("Could not cancel sign-up.");
            loadData();
        } else {
            toast.success("Sign-up cancelled.");
        }
    }

    /* ---------------------------------------
       UI: No club state
    --------------------------------------- */
    if (loading)
        return (
            <p className="text-center text-muted-foreground mt-10 animate-pulse">
                Loading tournaments…
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
                    You must belong to a club to access tournament signups.
                </p>
                <Button className="bg-gradient-to-r from-emerald-600 to-sky-500 text-white hover:opacity-90"
                    onClick={() => (window.location.href = "/")}>
                    Join a club
                </Button>
            </main>
        );
    }

    /* ---------------------------------------
       Prepare lists
    --------------------------------------- */
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const olderTournaments = tournaments.filter(
        (t) => new Date(t.event_date) < today
    );

    const recentAndUpcoming = tournaments.filter(
        (t) => new Date(t.event_date) >= today
    );

    /* ---------------------------------------
       Card Renderer
    --------------------------------------- */
    function renderTournamentCard(t: any) {
        const isSignedUp = t.tournament_signups.some(
            (su: any) => su.user_id === userId
        );

        const closed =
            t.signup_close_at && new Date(t.signup_close_at) < new Date();

        const eventDate = new Date(t.event_date).toLocaleDateString();
        const signupClose = t.signup_close_at
            ? new Date(t.signup_close_at).toLocaleString()
            : "N/A";

        return (
            <Card
                key={t.id}
                className={`rounded-2xl border border-white/5 bg-background/40 backdrop-blur-sm transition hover:shadow-md ${closed ? "opacity-70" : ""
                    }`}
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg font-semibold">
                                {t.title}
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                                {eventDate}
                            </CardDescription>

                            <p className="text-xs text-muted-foreground">
                                Sign-ups close: {signupClose}
                            </p>

                            {t.max_signups && (
                                <p className="text-xs text-muted-foreground">
                                    Capacity: {t.tournament_signups.length}/{t.max_signups}
                                </p>
                            )}

                            <p className="text-xs text-muted-foreground mt-1">
                                {t.tournament_signups.length} signed up
                            </p>
                        </div>

                        {closed && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-md">
                                Closed
                            </span>
                        )}
                    </div>
                </CardHeader>

                <CardFooter className="pt-2 justify-end">
                    {closed ? (
                        isSignedUp && (
                            <span className="text-xs text-green-600 font-medium">
                                You’re signed up ✓
                            </span>
                        )
                    ) : isSignedUp ? (
                        <button
                            onClick={() => handleCancel(t.id)}
                            className="rounded-md border px-3 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                            Cancel Sign-up
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSignup(t.id)}
                            className="rounded-md bg-gradient-to-r from-emerald-600 to-sky-500 text-white px-3 py-1 text-sm hover:opacity-90"
                        >
                            Sign Up
                        </button>
                    )}
                </CardFooter>
            </Card>
        );
    }

    /* ---------------------------------------
       Render Page
    --------------------------------------- */
    if (tournaments.length === 0)
        return (
            <p className="text-center text-muted-foreground mt-10">
                No tournaments available.
            </p>
        );

    return (
        <section className="space-y-8">
            {/* Recent + upcoming */}
            {recentAndUpcoming.length > 0 && (
                <div className="space-y-4">
                    {recentAndUpcoming.map((t) => renderTournamentCard(t))}
                </div>
            )}

            {/* Older toggle */}
            {olderTournaments.length > 0 && (
                <div className="mt-6 space-y-3">
                    <button
                        onClick={() => setShowOlder((v) => !v)}
                        className="rounded-xl border px-4 py-2 text-sm hover:bg-muted transition"
                    >
                        {showOlder
                            ? "Hide older tournaments"
                            : `Show older tournaments (${olderTournaments.length})`}
                    </button>

                    {showOlder && (
                        <div className="space-y-4 mt-3">
                            {olderTournaments.map((t) =>
                                renderTournamentCard(t)
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}