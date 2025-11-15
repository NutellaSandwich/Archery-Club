import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 * Works with async cookies() (Next.js 15+).
 */
export async function supabaseServer(): Promise<SupabaseClient> {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase env vars (URL or ANON KEY).");
    }

    return createServerClient(url, key, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set() {
                // No-op: handled automatically by Next.js middleware
            },
            remove() {
                // No-op
            },
        },
    });
}