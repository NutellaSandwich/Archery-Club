"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, User } from "lucide-react";
import { toast } from "sonner";

export default function JoinRequestsPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [clubId, setClubId] = useState<string | null>(null);

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
                    profiles:user_id(username, avatar_url),
                    clubs:club_id(name)
                `)
                .eq("club_id", clubId) // 🧠 Restrict to current user's club only
                .order("created_at", { ascending: false });

            if (error) {
                console.error(error);
                toast.error("Failed to load join requests.");
            } else {
                setRequests(data || []);
            }

            setLoading(false);
        }

        fetchRequests();
    }, [supabase, clubId]);

    async function updateStatus(id: string, status: "accepted" | "rejected") {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (!userId) return toast.error("You must be logged in.");

        const { error: updateError } = await supabase
            .from("join_requests")
            .update({ status, reviewed_by: userId })
            .eq("id", id)
            .eq("club_id", clubId); // ✅ Ensure update only applies within their club

        if (updateError) {
            toast.error("Failed to update request status.");
            return;
        }

        // If accepted, link user to club
        if (status === "accepted") {
            const req = requests.find((r) => r.id === id);
            if (req) {
                const { error: profileError } = await supabase
                    .from("profiles")
                    .update({ club_id: req.club_id })
                    .eq("id", req.user_id);

                if (profileError) toast.error("Failed to link user to club.");
            }
        }

        toast.success(`Request ${status}.`);
        setRequests((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status } : r))
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
                        <CardContent className="flex items-center justify-between">
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
                                </div>
                            ) : (
                                <span
                                    className={`text-sm font-medium ${r.status === "accepted"
                                            ? "text-green-500"
                                            : "text-red-500"
                                        }`}
                                >
                                    {r.status.toUpperCase()}
                                </span>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </main>
    );
}