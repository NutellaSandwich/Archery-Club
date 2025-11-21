"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
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
                router.push("/login");
                return;
            }

            setUserId(sessionUser.id);

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

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                if (!session) router.push("/login");
                else setUserId(session.user.id);
            }
        );

        return () => {
            listener?.subscription?.unsubscribe();
        };
    }, [supabase, router]);

    if (!sessionChecked) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                Loading dashboard...
            </div>
        );
    }

    return <ClubFeedWrapper userId={userId!} clubId={clubId} />;
}