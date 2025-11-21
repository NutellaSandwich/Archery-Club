import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name) {
                    return cookieStore.get(name)?.value;
                },
                set(name, value, options) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name, options) {
                    cookieStore.set({ name, value: "", ...options });
                },
            },
        }
    );

    // 🔒 Sign out the user
    await supabase.auth.signOut();

    // 🧭 Redirect to the main page instead of /login
    const res = NextResponse.redirect(
        new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    );

    // 🧹 Clear auth cookies
    res.cookies.delete("sb-access-token");
    res.cookies.delete("sb-refresh-token");

    return res;
}