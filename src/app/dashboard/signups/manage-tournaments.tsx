"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from "@/components/ui/card";

type Tournament = {
    id: string;
    title: string;
    event_date: string;
    signup_close_at: string | null;
    description: string | null;
    max_signups: number | null;
    tournament_signups: {
        user_id: string;
        profiles: {
            username: string;
            avatar_url: string | null;
        } | null;
    }[];
};

export default function ManageTournaments() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [newTournament, setNewTournament] = useState({
        title: "",
        event_date: "",
        signup_close_at: "",
        description: "",
        max_signups: "",
    });
    const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
    const [signups, setSignups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [isEditing, setIsEditing] = useState(false);

    const [editFields, setEditFields] = useState({
        title: "",
        event_date: "",
        signup_close_at: "",
        description: "",
        max_signups: "",
    });

    const [editingTournament, setEditingTournament] = useState<any | null>(null);

    // 🔁 Load tournaments from DB (with signup relations)
    async function loadTournaments() {
        setLoading(true);
        const { data, error } = await supabase
            .from("club_tournaments")
            .select(`
        id,
        title,
        event_date,
        signup_close_at,
        description,
        max_signups,
        tournament_signups!tournament_signups_tournament_id_fkey (
          user_id,
          profiles(username, avatar_url)
        )
    `)
            .order("event_date", { ascending: true });

        if (error) {
            console.error("Error loading tournaments:", error);
            toast.error("Error loading tournaments");
        } else {
            setTournaments(data || []);
            // ✅ Update modal signups if it's open
            if (selectedTournament) {
                const updated = data?.find((t: Tournament) => t.id === selectedTournament.id);                if (updated)
                    setSignups(updated.tournament_signups || []);
            }
        }
        setLoading(false);
    }

    // 🧠 Initial load
    useEffect(() => {
        loadTournaments();
    }, []);

    // 🔥 Realtime sync for tournaments and signups
    useEffect(() => {
        // Prevent duplicate channels
        supabase.removeAllChannels();

        const channel = supabase
            .channel("manage_tournament_live")
            // Tournament changes (creation, deletion, edit)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "club_tournaments" },
                async (payload: any) => {
                    console.log("Realtime tournament change:", payload);

                    // Reload all tournaments (rare event)
                    await loadTournaments();
                }
            )
            // Signups changes (insert/delete)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tournament_signups" },
                async (payload: any) => {
                    console.log("Realtime signup change:", payload);

                    const newRow = payload.new as { tournament_id?: string };
                    const oldRow = payload.old as { tournament_id?: string };
                    const tid = newRow?.tournament_id || oldRow?.tournament_id;

                    if (!tid) return;

                    // ✅ Fetch updated signups for just this tournament
                    const { data, error } = await supabase
                        .from("club_tournaments")
                        .select(`
            id,
            title,
            event_date,
            signup_close_at,
            description,
            max_signups,
            tournament_signups!tournament_signups_tournament_id_fkey (
              user_id,
              profiles(username)
            )
          `)
                        .eq("id", tid)
                        .single();

                    if (error) {
                        console.error("Error refreshing single tournament:", error);
                        return;
                    }

                    // ✅ Merge updated tournament into state
                    setTournaments((prev) => {
                        const exists = prev.find((t) => t.id === tid);
                        if (!exists) return [...prev, data];
                        return prev.map((t) => (t.id === tid ? data : t));
                    });

                    // ✅ Update open modal instantly
                    if (selectedTournament?.id === tid) {
                        setSignups(data.tournament_signups || []);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, selectedTournament]);

    // 🏗️ Create new tournament
    async function handleCreate() {
        if (!newTournament.title || !newTournament.event_date) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                toast.error("You must be logged in to create a tournament.");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", user.id)
                .single();

            const { error } = await supabase.from("club_tournaments").insert([
                {
                    title: newTournament.title,
                    event_date: newTournament.event_date,
                    signup_close_at: newTournament.signup_close_at || null,
                    signup_deadline: newTournament.signup_close_at || null,
                    description: newTournament.description,
                    max_signups: newTournament.max_signups
                        ? parseInt(newTournament.max_signups)
                        : null,
                    created_by: user.id,
                    club_id: profile?.club_id ?? null,
                },
            ]);

            if (error) {
                console.error("Insert error:", error);
                toast.error("Error creating tournament");
            } else {
                toast.success("Tournament created successfully!");
                setNewTournament({
                    title: "",
                    event_date: "",
                    signup_close_at: "",
                    description: "",
                    max_signups: "",
                });
                setTimeout(() => loadTournaments(), 200);
            }
        } catch (err) {
            console.error("Unexpected error creating tournament:", err);
            toast.error("Something went wrong");
        }
    }

    // 🗑️ Delete tournament
    async function handleDelete(id: string) {
        const { error } = await supabase
            .from("club_tournaments")
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Error deleting tournament");
            console.error(error);
        } else {
            toast.success("Tournament deleted");
            setSelectedTournament(null);
            setTimeout(() => loadTournaments(), 200);
        }
    }

    // 🧾 Open tournament details (modal)
    async function openTournamentDetails(tournament: any) {
        setSelectedTournament(tournament);

        setEditFields({
            title: tournament.title,
            event_date: tournament.event_date,
            signup_close_at: tournament.signup_close_at || "",
            description: tournament.description || "",
            max_signups: tournament.max_signups?.toString() || "",
        });
        setIsEditing(false);

        const { data, error } = await supabase
            .from("tournament_signups")
            .select("user_id, profiles(username, avatar_url)")
            .eq("tournament_id", tournament.id);

        if (error) {
            console.error("Error loading signups:", error);
            toast.error("Could not load tournament signups.");
            return;
        }

        setSignups(data || []);
    }

    async function handleUpdateTournament() {
        if (!selectedTournament) return;

        const { error } = await supabase
            .from("club_tournaments")
            .update({
                title: editFields.title,
                event_date: editFields.event_date,
                signup_close_at: editFields.signup_close_at || null,
                description: editFields.description,
                max_signups: editFields.max_signups
                    ? parseInt(editFields.max_signups)
                    : null,
            })
            .eq("id", selectedTournament.id);

        if (error) {
            console.error(error);
            toast.error("Error updating tournament");
            return;
        }

        toast.success("Tournament updated!");

        setIsEditing(false);

        // refresh the list
        loadTournaments();
    }

    return (
        <section className="space-y-6">
            {/* CREATE FORM */}
            <Card>
                <CardHeader>
                    <CardTitle>Create New Tournament</CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium">Title</label>
                        <input
                            placeholder="Tournament Title"
                            value={newTournament.title}
                            onChange={(e) =>
                                setNewTournament({ ...newTournament, title: e.target.value })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Event Date</label>
                        <input
                            type="date"
                            value={newTournament.event_date}
                            onChange={(e) =>
                                setNewTournament({
                                    ...newTournament,
                                    event_date: e.target.value,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            Sign-up Close Date & Time
                        </label>
                        <input
                            type="datetime-local"
                            value={newTournament.signup_close_at}
                            onChange={(e) =>
                                setNewTournament({
                                    ...newTournament,
                                    signup_close_at: e.target.value,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Max Sign-ups</label>
                        <input
                            type="number"
                            value={newTournament.max_signups}
                            onChange={(e) =>
                                setNewTournament({
                                    ...newTournament,
                                    max_signups: e.target.value,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <textarea
                            value={newTournament.description}
                            onChange={(e) =>
                                setNewTournament({
                                    ...newTournament,
                                    description: e.target.value,
                                })
                            }
                            className="border rounded-md px-2 py-1 w-full"
                            rows={2}
                        />
                    </div>
                </CardContent>

                <CardFooter>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-1 text-sm hover:opacity-90"
                    >
                        {loading ? "Creating..." : "Add Tournament"}
                    </button>
                </CardFooter>
            </Card>

            {/* TOURNAMENT LIST */}
            <div className="space-y-3">
                {tournaments.map((t) => (
                    <Card
                        key={t.id}
                        onClick={() => openTournamentDetails(t)}
                        className="cursor-pointer hover:bg-[hsl(var(--muted))]/20 transition"
                    >
                        <CardHeader>
                            <CardTitle>{t.title}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Event: {t.event_date} | Sign-ups close:{" "}
                                {t.signup_close_at
                                    ? new Date(t.signup_close_at).toLocaleString()
                                    : "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t.tournament_signups?.length || 0} signed up
                            </p>
                        </CardHeader>
                        <CardFooter className="justify-end gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTournament(t);
                                    setEditFields({
                                        title: t.title,
                                        event_date: t.event_date,
                                        signup_close_at: t.signup_close_at || "",
                                        description: t.description || "",
                                        max_signups: t.max_signups?.toString() || "",
                                    });
                                    setIsEditing(true);
                                }}
                                className="text-blue-600 text-sm underline"
                            >
                                Edit
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(t.id);
                                }}
                                className="text-red-600 text-sm underline"
                            >
                                Delete
                            </button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* POPUP MODAL */}
            {selectedTournament && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setSelectedTournament(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-md"
                    >
                        <h3 className="text-lg font-semibold mb-2">
                            {selectedTournament.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            Event on {selectedTournament.event_date}
                        </p>
                        <p className="text-sm mb-4">
                            Sign-ups close at:{" "}
                            {selectedTournament.signup_close_at
                                ? new Date(
                                    selectedTournament.signup_close_at
                                ).toLocaleString()
                                : "N/A"}
                        </p>


                        
                        <button
                            className="mt-4 bg-red-600 text-white w-full py-2 rounded-md"
                            onClick={() => setSelectedTournament(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {editingTournament && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setEditingTournament(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-xl w-[90%] max-w-md"
                    >
                        <h3 className="text-lg font-semibold mb-4">Edit Tournament</h3>

                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="text-sm font-medium">Title</label>
                                <input
                                    className="w-full border rounded-md px-2 py-1"
                                    value={editFields.title}
                                    onChange={(e) =>
                                        setEditFields({ ...editFields, title: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Event Date</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-md px-2 py-1"
                                    value={editFields.event_date}
                                    onChange={(e) =>
                                        setEditFields({ ...editFields, event_date: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Signup Close (Date & Time)</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border rounded-md px-2 py-1"
                                    value={editFields.signup_close_at}
                                    onChange={(e) =>
                                        setEditFields({
                                            ...editFields,
                                            signup_close_at: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Max Signups</label>
                                <input
                                    type="number"
                                    className="w-full border rounded-md px-2 py-1"
                                    value={editFields.max_signups}
                                    onChange={(e) =>
                                        setEditFields({
                                            ...editFields,
                                            max_signups: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    rows={2}
                                    className="w-full border rounded-md px-2 py-1"
                                    value={editFields.description}
                                    onChange={(e) =>
                                        setEditFields({
                                            ...editFields,
                                            description: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <button
                                onClick={handleUpdateTournament}
                                className="w-full rounded-md bg-primary text-primary-foreground py-2 hover:opacity-90"
                            >
                                Save Changes
                            </button>

                            <button
                                onClick={() => setEditingTournament(null)}
                                className="w-full rounded-md border py-2 text-sm hover:bg-muted"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}