"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";


/**
 * Redirects user to /dashboard when *confirmed* logged in.
 * Prevents loops on stale sessions or after sign-out.
 */
export function useSupabaseAuthRedirect() {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = supabaseBrowser();
    const hasRedirected = useRef(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        async function verifySession() {
            const { data } = await supabase.auth.getSession();
            const session = data?.session;

            // ⚠️ Check for real user data, not just ghost cookies
            if (session?.user?.email && pathname === "/login" && !hasRedirected.current) {
                console.log("✅ Valid user session — redirecting to /dashboard");
                hasRedirected.current = true;
                window.location.href = "/dashboard";
            } else {
                console.log("🔒 No valid user — staying on login");
            }
        }

        verifySession();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                console.log("🔄 Auth event:", event);
                if (
                    event === "SIGNED_IN" &&
                    session &&
                    pathname === "/login" &&
                    !hasRedirected.current
                ) {
                    console.log("✅ Detected SIGNED_IN — redirecting");
                    hasRedirected.current = true;
                    timeout = setTimeout(() => {
                        window.location.href = "/dashboard";
                    }, 200);
                }
            }
        );

        return () => {
            listener.subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [pathname, router, supabase]);
}