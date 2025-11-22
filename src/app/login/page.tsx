"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { useSupabaseAuthRedirect } from "@/hooks/useSupabaseAuthRedirect";

export default function LoginPage() {
    const router = useRouter();
    useSupabaseAuthRedirect();

    // ✅ Create Supabase client only in the browser
    const supabase = useMemo(() => {
        if (typeof window !== "undefined") {
            return supabaseBrowser();
        }
        return null;
    }, []);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [loading, setLoading] = useState(false);

    // 🧹 Ensure no old session
    useEffect(() => {
        if (!supabase) return;
        const clean = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                await supabase.auth.signOut();
                console.log("🧹 Cleared existing Supabase session");
            } else {
                console.log("✅ No session found — clean state");
            }
        };
        clean();
    }, [supabase]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!supabase) return toast.error("Supabase not ready.");

        setLoading(true);

        try {
            if (!email || !password) {
                toast.error("Please enter email and password.");
                return;
            }

            if (mode === "login") {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Logged in successfully!");
                router.push("/dashboard");
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success("Account created! You can now log in.");
                setMode("login");
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            toast.error(err.message || "Authentication failed.");
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotPassword() {
        if (!supabase) return toast.error("Supabase not ready.");
        if (!email || !email.includes("@")) {
            toast.error("Please enter your email first.");
            return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            toast.error(error.message || "Failed to send reset link.");
        } else {
            toast.success("Password reset link sent! Check your email.");
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm w-80"
            >
                <h1 className="text-xl font-semibold text-center">
                    {mode === "login" ? "Login" : "Sign Up"}
                </h1>

                <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2"
                />

                <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2"
                />

                {mode === "login" && (
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm text-blue-500 hover:underline self-end"
                    >
                        Forgot your password?
                    </button>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60"
                >
                    {loading
                        ? mode === "login"
                            ? "Logging in..."
                            : "Creating account..."
                        : mode === "login"
                            ? "Login"
                            : "Sign Up"}
                </button>

                <p className="text-sm text-center mt-2">
                    {mode === "login" ? (
                        <>
                            Don’t have an account?{" "}
                            <button
                                type="button"
                                onClick={() => setMode("signup")}
                                className="text-[hsl(var(--primary))] hover:underline"
                            >
                                Sign up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{" "}
                            <button
                                type="button"
                                onClick={() => setMode("login")}
                                className="text-[hsl(var(--primary))] hover:underline"
                            >
                                Log in
                            </button>
                        </>
                    )}
                </p>
            </form>
        </main>
    );
}