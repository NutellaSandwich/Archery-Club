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
      full_name,
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

        console.log("updateStatus →", { id, clubId, userId, status });

        if (!userId) {
            toast.error("You must be logged in.");
            return;
        }

        const { error: updateError } = await supabase
            .from("join_requests")
            .update({ status, reviewed_by: userId })
            .eq("id", id)
            .eq("club_id", clubId);

        if (updateError) {
            console.error("updateError →", updateError);
            toast.error("Failed to update request status.");
            return;
        }

        toast.success(`Request ${status}.`);
        setRequests((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
    }

    function EditRequestModal({ request, onClose, onSave }: any) {
        const [form, setForm] = useState({
            full_name: request.full_name || "",
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
                    full_name: form.full_name,
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
                toast.success("Request updated!");
                onSave(form);
                onClose();
            }
        }

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div
                    className="bg-[hsl(var(--card))] rounded-xl p-6 max-w-md w-full border border-[hsl(var(--border))]/40"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-lg font-semibold mb-3">Edit Request</h2>

                    <div className="space-y-3">
                        <input
                            className="w-full p-2 border rounded bg-background"
                            placeholder="Full Name"
                            value={form.full_name}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
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
            <h1 className="text-2xl font-semibold text-center">Join Requests</h1>

            {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
            ) : requests.length === 0 ? (
                <p className="text-center text-muted-foreground">
                    No join requests for your club.
                </p>
            ) : (
                requests.map((r) => (
                    <Card key={r.id} className="border border-[hsl(var(--border))]/40">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User size={18} /> {r.profiles?.username || "Unknown"}{" "}
                                <span className="text-sm text-muted-foreground">
                                    ({r.clubs?.name || "Unknown Club"})
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p><strong>Full Name:</strong> {r.full_name || "—"}</p>
                            <p><strong>Category:</strong> {r.category || "—"}</p>
                            <p><strong>Experience:</strong> {r.experience || "—"}</p>
                            {r.agb_number && <p><strong>AGB Number:</strong> {r.agb_number}</p>}
                            {r.dob && <p><strong>DOB:</strong> {new Date(r.dob).toLocaleDateString()}</p>}
                            <p className="text-sm text-muted-foreground">
                                Requested on {new Date(r.created_at).toLocaleDateString()}
                            </p>

                            {r.status === "pending" ? (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => updateStatus(r.id, "accepted")}
                                        className="flex items-center gap-1"
                                    >
                                        <CheckCircle size={14} /> Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => updateStatus(r.id, "rejected")}
                                        className="flex items-center gap-1"
                                    >
                                        <XCircle size={14} /> Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setEditingRequest(r)}
                                        className="flex items-center gap-1"
                                    >
                                        <Pencil size={14} /> Edit
                                    </Button>
                                </div>
                            ) : (
                                <span
                                    className={`text-sm font-medium ${r.status === "accepted" ? "text-green-500" : "text-red-500"
                                        }`}
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
                        full_name?: string;
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