"use client";

import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"; import { toast } from "sonner";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";

export default function TournamentSignups() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ Load tournaments
    async function loadData() {
        setLoading(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const currentUserId = user?.id || null;
            setUserId(currentUserId);

            const today = new Date().toISOString().split("T")[0];

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
                .gte("event_date", today)
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
                (payload: RealtimePostgresChangesPayload<{
                    id: string;
                    tournament_id: string;
                    user_id: string;
                }>) => {
                    console.log("Realtime update triggered:", payload);

                    clearTimeout(realtimeTimer);
                    realtimeTimer = setTimeout(() => {
                        loadData();
                    }, 400);
                }
            )
            .subscribe();

        return () => {
            clearTimeout(realtimeTimer);
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    // 🟢 Sign up
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
            toast.info("You’re already signed up for this tournament.");
            return;
        }

        // ✅ Optimistic UI first
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
            console.error("Signup error:", error);
            toast.error("Error signing up.");

            // Roll back optimistic UI on failure
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
        } else {
            toast.success("Signed up successfully!");

            // Delay full reload to let Supabase catch up
            setTimeout(() => loadData(), 1000);
        }
    }

    // 🔴 Cancel signup
    async function handleCancel(tournamentId: string) {
        if (!userId) return;

        // ✅ Optimistic UI first
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
            console.error("Cancel error:", error);
            toast.error("Could not cancel sign-up.");

            // Roll back optimistic UI on failure
            loadData();
        } else {
            toast.success("Cancelled sign-up.");

            // Delay reload slightly so Supabase reflects it
            setTimeout(() => loadData(), 1000);
        }
    }

    // 🕒 Loading states
    if (loading || !userId) {
        return (
            <p className="text-center text-muted-foreground mt-10">
                Loading tournaments...
            </p>
        );
    }

    if (tournaments.length === 0)
        return (
            <p className="text-center text-muted-foreground mt-10">
                No upcoming tournaments.
            </p>
        );

    // 🎨 Render UI
    return (
        <section>
            <div className="space-y-4">
                {tournaments.map((t) => {
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
                            className={`transition hover:shadow-md ${closed ? "opacity-75" : ""
                                }`}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{t.title}</CardTitle>
                                        <CardDescription>{eventDate}</CardDescription>
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

                            <CardFooter className="justify-end">
                                {closed ? (
                                    isSignedUp && (
                                        <span className="text-xs text-green-600 font-medium">
                                            You’re signed up ✅
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
                                        className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1 text-sm hover:opacity-90"
                                    >
                                        Sign Up
                                    </button>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}