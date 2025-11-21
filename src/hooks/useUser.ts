"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";


/**
 * Provides the current Supabase user session (client-side).
 * Returns { user, loading }
 */
export function useUser() {
    const supabase = supabaseBrowser();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadUser() {
            const { data } = await supabase.auth.getSession();
            setUser(data?.session?.user ?? null);
            setLoading(false);
        }

        loadUser();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (_event: AuthChangeEvent, session: Session | null) => {
                setUser(session?.user ?? null);
            }
        );

        return () => listener.subscription.unsubscribe();
    }, [supabase]);

    return { user, loading };
}