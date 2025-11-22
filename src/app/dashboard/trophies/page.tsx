"use client";

import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, PlusCircle, User, X } from "lucide-react";
import { Trash2 } from "lucide-react";

export default function TrophiesPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [trophies, setTrophies] = useState<any[]>([]);
    const [newTrophy, setNewTrophy] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState<Record<string, string>>({});
    const [clubId, setClubId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [trophyToDelete, setTrophyToDelete] = useState<string | null>(null);

    // ✅ Load user profile and club-based data
    useEffect(() => {
        async function loadData() {
            setLoading(true);

            // 🔹 Get current session
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                toast.error("You must be logged in to view this page.");
                setLoading(false);
                return;
            }

            // 🔹 Get current user's club_id
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", user.id)
                .single();

            if (profileError || !profile?.club_id) {
                toast.error("You are not part of a club.");
                setLoading(false);
                return;
            }

            const clubId = profile.club_id;
            setClubId(clubId);

            // 🔹 Fetch trophies belonging to this club
            const { data: trophiesData, error: trophiesError } = await supabase
                .from("trophies")
                .select("id, name, assigned_to, assigned_at, created_at, club_id")
                .eq("club_id", clubId)
                .order("created_at", { ascending: false });

            // 🔹 Fetch users in this club
            const { data: usersData, error: usersError } = await supabase
                .from("profiles")
                .select("id, username, club_id")
                .eq("club_id", clubId);

            if (trophiesError || usersError) {
                toast.error("Error loading trophies or users.");
            } else {
                setTrophies(trophiesData || []);
                setUsers(usersData || []);
            }

            setLoading(false);
        }

        loadData();
    }, [supabase]);

    // ✅ Create new trophy — tied to current club
    async function handleCreate() {
        if (!newTrophy.trim()) return toast.error("Trophy name required");
        if (!clubId) return toast.error("You are not part of a club.");

        const { data, error } = await supabase
            .from("trophies")
            .insert({ name: newTrophy, club_id: clubId })
            .select()
            .single();

        if (error) {
            console.error(error);
            return toast.error("Error creating trophy");
        }

        toast.success("Trophy created");
        setTrophies((prev) => [data, ...prev]);
        setNewTrophy("");
    }

    // ✅ Assign to user (only within club)
    async function handleAssign(trophyId: string, userId: string | null) {
        const updates = userId
            ? { assigned_to: userId, assigned_at: new Date().toISOString() }
            : { assigned_to: null, assigned_at: null };

        const { data, error } = await supabase
            .from("trophies")
            .update(updates)
            .eq("id", trophyId)
            .eq("club_id", clubId) // ensure safety
            .select()
            .single();

        if (error) return toast.error("Error updating trophy");

        setTrophies((prev) =>
            prev.map((t) => (t.id === trophyId ? { ...t, ...data } : t))
        );

        toast.success(userId ? "Trophy assigned" : "Trophy cleared");
    }

    async function handleDelete(trophyId: string) {
        const { error } = await supabase
            .from("trophies")
            .delete()
            .eq("id", trophyId)
            .eq("club_id", clubId);

        if (error) {
            console.error(error);
            return toast.error("Error deleting trophy");
        }

        setTrophies((prev) => prev.filter((t) => t.id !== trophyId));
    }

    if (loading)
        return (
            <p className="text-center mt-10 text-muted-foreground">
                Loading trophies...
            </p>
        );

    if (!clubId)
        return (
            <p className="text-center mt-10 text-muted-foreground">
                You must be part of a club to view trophies.
            </p>
        );

    return (
        <main className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={28} /> Trophies
                </h1>
            </div>

            {/* 🏗️ Trophy Creation */}
            <Card className="p-4 flex gap-3 items-center">
                <Input
                    placeholder="New trophy name"
                    value={newTrophy}
                    onChange={(e) => setNewTrophy(e.target.value)}
                />
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <PlusCircle size={16} /> Create
                </Button>
            </Card>

            {/* 🏆 Trophy List */}
            <div className="grid gap-4">
                {trophies.length === 0 && (
                    <p className="text-muted-foreground text-center">
                        No trophies created yet.
                    </p>
                )}

                {trophies.map((trophy) => {
                    const assignedUser =
                        users.find((u) => u.id === trophy.assigned_to)?.username || null;
                    const filterText = search[trophy.id]?.toLowerCase() ?? "";

                    const filteredUsers = users.filter((u) =>
                        u.username.toLowerCase().includes(filterText)
                    );

                    return (
                        <Card
                            key={trophy.id}
                            className="border border-[hsl(var(--border))]/40 rounded-xl shadow-sm hover:shadow-md transition"
                        >
                            <CardHeader className="flex justify-between items-center px-4 py-3 border-b">
                                <div className="flex items-center gap-3">
                                    <Trophy
                                        size={20}
                                        className={`${assignedUser ? "text-yellow-500" : "text-muted-foreground"
                                            } transition-colors`}
                                    />
                                    <h2 className="font-semibold">{trophy.name}</h2>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User size={14} />
                                        {assignedUser ? (
                                            <span className="text-foreground font-medium">
                                                {assignedUser}
                                            </span>
                                        ) : (
                                            <span>Club has it</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 h-8"
                                            onClick={() => handleAssign(trophy.id, null)}
                                        >
                                            <X size={14} /> Clear
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 h-8 w-8"
                                            onClick={() => {
                                                setTrophyToDelete(trophy.id);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 relative">
                                    <Input
                                        placeholder="Search user..."
                                        value={search[trophy.id] || ""}
                                        onChange={(e) =>
                                            setSearch((prev) => ({
                                                ...prev,
                                                [trophy.id]: e.target.value,
                                            }))
                                        }
                                        className="flex-1 text-sm"
                                    />

                                    {filterText && (
                                        <div className="absolute bg-[hsl(var(--popover))] border border-[hsl(var(--border))]/50 mt-10 rounded-md shadow-lg z-50 w-[200px] max-h-[180px] overflow-y-auto">
                                            {filteredUsers.map((u) => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => {
                                                        handleAssign(trophy.id, u.id);
                                                        setSearch((prev) => ({
                                                            ...prev,
                                                            [trophy.id]: "",
                                                        }));
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]/30 transition"
                                                >
                                                    {u.username}
                                                </button>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <p className="text-xs text-center text-muted-foreground p-2">
                                                    No matches
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {trophy.assigned_at && (
                                    <p className="text-xs text-muted-foreground text-right">
                                        Assigned on{" "}
                                        {new Date(trophy.assigned_at).toLocaleDateString(
                                            "en-GB",
                                            {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            }
                                        )}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-lg w-[90%] max-w-sm space-y-4">
                        <h3 className="text-lg font-semibold text-center text-red-600">
                            Delete Trophy
                        </h3>
                        <p className="text-sm text-muted-foreground text-center">
                            Are you sure you want to delete this trophy? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={async () => {
                                    if (trophyToDelete) await handleDelete(trophyToDelete);
                                    setShowDeleteModal(false);
                                    setTrophyToDelete(null);
                                }}
                            >
                                Confirm Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}