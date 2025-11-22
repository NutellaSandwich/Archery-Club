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
            <div className="max-w-md w-full bg-[hsl(var(--card))] p-6 rounded-xl border border-[hsl(var(--border))]/40 shadow-sm space-y-4">
                <h1 className="text-xl font-semibold text-center">Reset Password</h1>
                <Input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button onClick={handleReset} disabled={loading} className="w-full">
                    {loading ? "Updating..." : "Update Password"}
                </Button>
            </div>
        </main>
    );
}