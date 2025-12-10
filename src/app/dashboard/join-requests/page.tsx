"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, User, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function JoinRequestsPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [clubId, setClubId] = useState<string | null>(null);
    const [editingRequest, setEditingRequest] = useState<any | null>(null);

    // ✅ Fetch the logged-in user’s club_id first
    useEffect(() => {
        async function fetchClubId() {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return;

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("club_id")
                .eq("id", userId)
                .single();

            if (error) {
                console.error("Failed to fetch club_id", error);
                toast.error("Failed to fetch your club info");
                return;
            }

            setClubId(profile?.club_id || null);
        }

        fetchClubId();
    }, [supabase]);

    // ✅ Fetch join requests for the user’s club only
    useEffect(() => {
        if (!clubId) return;
        async function fetchRequests() {
            setLoading(true);
            const { data, error } = await supabase
                .from("join_requests")
                .select(`
  id,
  user_id,
  club_id,
  status,
  created_at,
  username,
  dob,
  agb_number,
  category,
  experience,
  profiles:user_id(username, avatar_url),
  clubs:club_id(name)
`)
                .eq("club_id", clubId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching join_requests:", error);
                toast.error("Failed to load join requests.");
            } else {
                console.log("Fetched join requests:", data);
                setRequests(data || []);
            }

            setLoading(false);
        }

        fetchRequests();
    }, [supabase, clubId]);

    async function updateStatus(id: string, status: "accepted" | "rejected") {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (!userId) {
            toast.error("You must be logged in.");
            return;
        }

        // Log which request is being handled
        const req = requests.find((r) => r.id === id);
        console.log("🧠 updateStatus called with:", { id, clubId, userId, req });

        // Update join_requests.status
        const { error: updateError } = await supabase
            .from("join_requests")
            .update({ status, reviewed_by: userId })
            .eq("id", id)
            .eq("club_id", clubId);

        if (updateError) {
            console.error("❌ updateError →", updateError);
            toast.error(`Failed to update request status: ${updateError.message}`);
            return;
        }

        // ✅ Link user to the club if accepted
        if (status === "accepted" && req?.user_id && req?.club_id) {
            console.log("🔗 Linking user to club:", req.user_id, "→", req.club_id);

            const { data, error: profileError } = await supabase
                .from("profiles")
                .update({ club_id: req.club_id })
                .eq("id", req.user_id)
                .select("id, club_id");

            console.log("🔍 Profile update result:", { data, profileError });

            if (profileError) {
                toast.error("Failed to link user to club.");
                console.error(profileError);
            } else if (data?.length) {
                toast.success("User successfully added to the club!");
            } else {
                toast.error("No matching profile found for that user_id!");
            }
        } else if (status === "accepted") {
            console.warn("⚠️ Missing user_id or club_id in join_requests record:", req);
        }

        setRequests((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
    }

    function EditRequestModal({ request, onClose, onSave }: any) {
        const [form, setForm] = useState({
            username: request.username || "",
            category: request.category || "",
            experience: request.experience || "",
            agb_number: request.agb_number || "",
            dob: request.dob ? request.dob.split("T")[0] : "",
        });
        const [saving, setSaving] = useState(false);
        const supabase = useMemo(() => supabaseBrowser(), []);

        async function handleSave() {
            setSaving(true);
            const { error } = await supabase
                .from("join_requests")
                .update({
                    agb_number: form.agb_number,
                    dob: form.dob,
                    category: form.category,
                    experience: form.experience,
                })
                .eq("id", request.id);

            setSaving(false);
            if (error) {
                console.error("Edit join_requests error:", error);
                toast.error("Failed to update request info.");
            } else {
                onSave(form);
                onClose();
            }
        }

        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div
                    className="
        group relative bg-[hsl(var(--card))] rounded-xl p-6 max-w-md w-full
        border border-border/40 shadow-xl
        overflow-hidden
    "
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="
        absolute inset-0 opacity-20 rounded-xl
        bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-emerald-500/20
        blur-2xl pointer-events-none
    "></div>
                    <h2 className="text-lg font-semibold mb-3">Edit Request</h2>

                    <div className="space-y-3">
                        <input
                            className="w-full p-2 border rounded bg-muted cursor-not-allowed text-muted-foreground"
                            placeholder="Username"
                            value={form.username}
                            disabled
                        />
                        <input
                            className="w-full p-2 border rounded bg-background"
                            placeholder="AGB Number"
                            value={form.agb_number}
                            onChange={(e) => setForm({ ...form, agb_number: e.target.value })}
                        />
                        <input
                            type="date"
                            className="w-full p-2 border rounded bg-background"
                            value={form.dob}
                            onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        />
                        <select
                            className="w-full p-2 border rounded bg-background"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                            <option>Open</option>
                            <option>Women</option>
                        </select>
                        <select
                            className="w-full p-2 border rounded bg-background"
                            value={form.experience}
                            onChange={(e) => setForm({ ...form, experience: e.target.value })}
                        >
                            <option>Novice</option>
                            <option>Experienced</option>
                        </select>

                        <div className="flex justify-end gap-2 mt-3">
                            <Button variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            {/* PAGE TITLE */}
<div className="text-center mb-4">
    <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
        Join Requests
    </h1>
    <div className="w-40 h-1 mx-auto mt-2 rounded-full bg-gradient-to-r
        from-emerald-500 via-sky-500 to-emerald-500 opacity-40">
    </div>
</div>

            {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
            ) : requests.length === 0 ? (
                <p className="text-center text-muted-foreground">
                    No join requests for your club.
                </p>
            ) : (
                requests.map((r) => (
                    <Card
                        key={r.id}
                        className="
        group relative px-4 py-3 sm:px-6 sm:py-4
        border border-border/50 rounded-xl bg-muted/30
        shadow-sm hover:shadow-md transition
        hover:bg-muted/50 overflow-hidden
    "
                    >
                        {/* Glow */}
                        <div
                            className="
            absolute inset-0 rounded-xl opacity-0 group-hover:opacity-40
            bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-emerald-500/10
            blur-xl transition-opacity duration-300 pointer-events-none
        "
                        ></div>
                        <CardHeader className="relative pb-3">
                            <div className="
        absolute inset-x-0 -bottom-[1px] h-[2px]
        bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-emerald-500/40
        rounded-full
    "></div>
                            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-base sm:text-lg leading-snug">
                                <User size={18} /> {r.profiles?.username || "Unknown"}{" "}
                                <span className="text-sm text-muted-foreground">
                                    ({r.clubs?.name || "Unknown Club"})
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-y-1">
                                <span className="font-medium text-muted-foreground">Category:</span>
                                <span>{r.category || "—"}</span>

                                <span className="font-medium text-muted-foreground">Experience:</span>
                                <span>{r.experience || "—"}</span>

                                {r.agb_number && (
                                    <>
                                        <span className="font-medium text-muted-foreground">AGB #:</span>
                                        <span>{r.agb_number}</span>
                                    </>
                                )}

                                {r.dob && (
                                    <>
                                        <span className="font-medium text-muted-foreground">DOB:</span>
                                        <span>{new Date(r.dob).toLocaleDateString()}</span>
                                    </>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-1">
                                Requested on {new Date(r.created_at).toLocaleDateString()}
                            </p>

                            {r.status === "pending" ? (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <Button
                                        size="sm"
                                        className="
        flex-1 min-w-[110px] rounded-lg
        bg-gradient-to-r from-emerald-600/20 to-sky-500/20
        border border-emerald-600/30
        hover:from-emerald-600/30 hover:to-sky-500/30
    "
                                        onClick={() => updateStatus(r.id, "accepted")}
                                    >
                                        Accept
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1 min-w-[110px] rounded-lg"
                                        onClick={() => updateStatus(r.id, "rejected")}
                                    >
                                        Reject
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="flex-1 min-w-[110px] rounded-lg"
                                        onClick={() => setEditingRequest(r)}
                                    >
                                        Edit
                                    </Button>
                                </div>
                            ) : (
                                    <span
                                        className={`
        inline-flex px-3 py-1 rounded-full text-xs font-semibold
        ${r.status === "accepted"
                                                ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300"
                                                : "bg-red-600/20 text-red-700 dark:text-red-300"
                                            }
    `}
                                    >
                                        {r.status.toUpperCase()}
                                    </span>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
            {editingRequest && (
                <EditRequestModal
                    request={editingRequest}
                    onClose={() => setEditingRequest(null)}
                    onSave={(updated: {
                        username?: string;
                        category?: string;
                        experience?: string;
                        agb_number?: string;
                        dob?: string;
                    }) =>
                        setRequests((prev) =>
                            prev.map((r) =>
                                r.id === editingRequest.id ? { ...r, ...updated } : r
                            )
                        )
                    }
                />
            )}
        </main>
    );
}