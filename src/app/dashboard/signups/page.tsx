"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SessionSignups from "./session-signups";
import TournamentSignups from "./tournament-signups";
import ManageSessions from "./manage-sessions";
import ManageTournaments from "./manage-tournaments";
import { motion } from "framer-motion";

export default function SignupsPage() {
    const [tab, setTab] = useState("sessions");
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    // Lazy load Supabase
    const supabase = useMemo(() => {
        const { supabaseBrowser } = require("@/lib/supabase-browser");
        return supabaseBrowser();
    }, []);

    useEffect(() => {
        async function checkAdmin() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) return setLoading(false);

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                setIsAdmin(profile?.role === "admin" || profile?.role === "officer");
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        checkAdmin();
    }, [supabase]);

    const tabs = [
        { key: "sessions", label: "Sessions" },
        { key: "tournaments", label: "Tournaments" },
        ...(isAdmin
            ? [
                { key: "manage-sessions", label: "Manage Sessions" },
                { key: "manage-tournaments", label: "Manage Tournaments" },
            ]
            : []),
    ];

    return (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

            {/* HEADER */}
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-sky-500 bg-clip-text text-transparent">
                    Club Sign-Ups
                </h1>
                <p className="text-sm text-muted-foreground">
                    View and manage all sessions and tournaments
                </p>
            </div>

            {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
            ) : (
                <Tabs value={tab} onValueChange={setTab} className="space-y-6">

                    {/* ⭐ TABS LIST WITH ACTIVE INDICATOR ⭐ */}
                        <TabsList
                            className="
        mb-6
        w-full
        flex flex-nowrap       /* Force flexbox behavior */
        justify-start          /* 👈 CRITICAL: Starts items from the left so they don't clip off-screen */
        overflow-x-auto        /* Allows scrolling */
        no-scrollbar           /* Custom class to hide scrollbar (ensure you have this CSS) */
        gap-2
        rounded-2xl
        bg-muted/40
        border border-border/40
        h-auto                 /* 👈 Allows height to fit content + padding properly */
        p-1                    /* uniform padding */
        shadow-sm
    "
                        >
                            {tabs.map((t) => (
                                <TabsTrigger
                                    key={t.key}
                                    value={t.key}
                                    className="
                shrink-0            /* 👈 Prevents squishing */
                min-w-max           /* 👈 Ensures text doesn't wrap awkwardly */
                relative z-10
                whitespace-nowrap
                px-4 py-2
                rounded-xl text-sm font-medium
                transition
                hover:bg-muted/40
                data-[state=active]:text-white
            "
                                >
                                    {tab === t.key && (
                                        <motion.div
                                            layoutId="active-pill"
                                            transition={{
                                                type: 'spring',
                                                stiffness: 300,
                                                damping: 25,
                                            }}
                                            className="
                        absolute inset-0 rounded-xl
                        bg-gradient-to-r from-emerald-500 to-sky-500
                        shadow-sm
                    "
                                        />
                                    )}
                                    <span className="relative z-10 pl-1">{t.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>

                    {/* CONTENT */}
                    <div className="mt-4">
                        <TabsContent value="sessions">
                            <SessionSignups />
                        </TabsContent>

                        <TabsContent value="tournaments">
                            <TournamentSignups />
                        </TabsContent>

                        {isAdmin && (
                            <>
                                <TabsContent value="manage-sessions">
                                    <ManageSessions />
                                </TabsContent>

                                <TabsContent value="manage-tournaments">
                                    <ManageTournaments />
                                </TabsContent>
                            </>
                        )}
                    </div>
                </Tabs>
            )}
        </main>
    );
}