"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

/**
 * Wrap any page that requires authentication.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            console.warn("🔒 No user session — redirecting to /login");
            router.replace("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-muted-foreground">Checking session...</p>
            </div>
        );
    }

    // Render protected content once user is confirmed
    if (!user) return null;

    return <>{children}</>;
}