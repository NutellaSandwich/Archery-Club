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
        <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-background/50">
            <form
                onSubmit={handleSubmit}
                className="
    flex flex-col gap-5 
    w-80 
    rounded-2xl 
    border border-border/40 
    bg-muted/30 backdrop-blur-xl 
    p-8 shadow-sm
"
            >
                <h1
    className="
        text-2xl font-semibold text-center 
        bg-gradient-to-r from-emerald-500 to-sky-500 
        bg-clip-text text-transparent
    "
>
                    {mode === "login" ? "Login" : "Sign Up"}
                </h1>

                <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="
    rounded-xl 
    border border-border/40 
    bg-muted/20 backdrop-blur-sm 
    px-3 py-2 text-sm
"
                />

                <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="
    rounded-xl 
    border border-border/40 
    bg-muted/20 backdrop-blur-sm 
    px-3 py-2 text-sm
"
                />

                {mode === "login" && (
                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm text-emerald-600 hover:underline mx-auto"                    >
                        Forgot your password?
                    </button>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="
    rounded-xl 
    bg-gradient-to-r from-emerald-600 to-sky-500 
    text-white 
    px-4 py-2 
    font-medium 
    hover:opacity-90 
    disabled:opacity-50
"
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
                                className="text-emerald-600 hover:underline font-medium"
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
                                className="text-emerald-600 hover:underline font-medium"
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