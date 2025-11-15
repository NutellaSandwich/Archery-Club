"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SessionSignups from "./session-signups";
import TournamentSignups from "./tournament-signups";
import ManageSessions from "./manage-sessions";
import ManageTournaments from "./manage-tournaments";

export default function SignupsPage() {
    const [tab, setTab] = useState("sessions");
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    // ✅ Lazy-import Supabase browser client
    const supabase = useMemo(() => {
        const { supabaseBrowser } = require("@/lib/supabase-browser");
        return supabaseBrowser();
    }, []);

    useEffect(() => {
        async function checkAdmin() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) {
                    setIsAdmin(false);
                    setLoading(false);
                    return;
                }

                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                if (error) {
                    console.error("Failed to load profile role:", error);
                    setIsAdmin(false);
                } else {
                    setIsAdmin(profile?.role === "admin" || profile?.role === "officer");
                }
            } catch (err) {
                console.error("Error checking admin status:", err);
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        }

        checkAdmin();
    }, [supabase]);

    return (
        <main className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-semibold mb-6 text-center">Club Sign Ups</h1>

            {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
            ) : (
                <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="flex justify-center mb-6 flex-wrap gap-2">
                        <TabsTrigger value="sessions">Sessions</TabsTrigger>
                        <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
                        {isAdmin && (
                            <>
                                <TabsTrigger value="manage-sessions">Manage Sessions</TabsTrigger>
                                <TabsTrigger value="manage-tournaments">Manage Tournaments</TabsTrigger>
                            </>
                        )}
                    </TabsList>

                    <TabsContent value="sessions"><SessionSignups /></TabsContent>
                    <TabsContent value="tournaments"><TournamentSignups /></TabsContent>

                    {isAdmin && (
                        <>
                            <TabsContent value="manage-sessions"><ManageSessions /></TabsContent>
                            <TabsContent value="manage-tournaments"><ManageTournaments /></TabsContent>
                        </>
                    )}
                </Tabs>
            )}
        </main>
    );
}