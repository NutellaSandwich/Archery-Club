"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import ClubFeedWrapper from "./club-feed-wrapper";

export default function DashboardPage() {
    const router = useRouter();
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [sessionChecked, setSessionChecked] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [clubId, setClubId] = useState<string | null>(null);

    useEffect(() => {
        async function loadSession() {
            const { data } = await supabase.auth.getSession();
            const sessionUser = data?.session?.user;

            if (!sessionUser) {
                // not signed in → go to login
                router.push("/login");
                return;
            }

            setUserId(sessionUser.id);

            // fetch profile to get club_id
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", sessionUser.id)
                .maybeSingle();

            if (error) console.error("Profile fetch error:", error);

            setClubId(profile?.club_id ?? null);
            setSessionChecked(true);
        }

        loadSession();

        // watch for auth changes
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) router.push("/login");
            else setUserId(session.user.id);
        });

        return () => listener?.subscription?.unsubscribe?.();
    }, [supabase, router]);

    if (!sessionChecked) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                Loading dashboard...
            </div>
        );
    }

    // ✅ render feed only when session and profile are ready
    return <ClubFeedWrapper userId={userId!} clubId={clubId} />;
}