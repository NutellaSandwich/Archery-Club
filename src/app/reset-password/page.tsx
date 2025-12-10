"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleReset() {
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters long.");
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            toast.error(error.message || "Failed to reset password.");
        } else {
            toast.success("Password updated successfully!");
            router.push("/login");
        }
        setLoading(false);
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div
                className="
                    max-w-md w-full
                    rounded-2xl 
                    border border-border/40 
                    bg-muted/30 backdrop-blur-xl
                    shadow-md 
                    p-8 
                    space-y-6
                "
            >
                <h1
                    className="
                        text-3xl font-semibold text-center
                        bg-gradient-to-r from-emerald-500 to-sky-500
                        bg-clip-text text-transparent
                    "
                >
                    Reset Password
                </h1>

                <Input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="
                        rounded-xl 
                        border border-border/40 
                        bg-muted/20 backdrop-blur-sm 
                        px-4 py-2.5
                        text-sm
                    "
                />

                <Input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="
                        rounded-xl 
                        border border-border/40 
                        bg-muted/20 backdrop-blur-sm 
                        px-4 py-2.5
                        text-sm
                    "
                />

                <Button
                    onClick={handleReset}
                    disabled={loading}
                    className="
                        w-full 
                        rounded-xl 
                        bg-gradient-to-r from-emerald-600 to-sky-500 
                        text-white 
                        py-2.5 
                        font-medium 
                        hover:opacity-90 
                        transition 
                        disabled:opacity-50
                    "
                >
                    {loading ? "Updating..." : "Update Password"}
                </Button>
            </div>
        </main>
    );
}