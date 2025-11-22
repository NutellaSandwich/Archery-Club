"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import Image from "next/image";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface DashboardClientProps {
    initialUser: User | null;
}

interface Profile {
    id: string;
    username: string | null;
    bow_type: string | null;
    category: string | null;
    experience: string | null;
    created_at: string;
    club_id: string | null;
    is_admin: boolean;
    avatar_url: string | null;
    handicap: number | null;
}

interface ClubInfo {
    id: string;
    name: string;
    location: string | null;
    description: string | null;
    member_count?: number;
}

export default function DashboardClient({ initialUser }: DashboardClientProps) {
    const router = useRouter();

    // ✅ Lazy init Supabase client for client-side safety
    const [supabase, setSupabase] = useState<ReturnType<typeof supabaseBrowser> | null>(null);

    const [user, setUser] = useState<User | null>(initialUser);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [clubs, setClubs] = useState<ClubInfo[]>([]);
    const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [editing, setEditing] = useState(false);

    const [form, setForm] = useState({
        bow_type: "",
        category: "",
        experience: "",
        avatar_url: "",
        handicap: 0,
        club_id: "",
    });

    // ✅ Initialize supabase only after mount
    useEffect(() => {
        setSupabase(supabaseBrowser());
    }, []);

    // 🧩 Fetch profile + clubs + club info
    useEffect(() => {
        if (!supabase || !user) return;

        async function fetchAll() {
            try {
                // ✅ Guards prevent null access
                if (!supabase || !user) return;

                const [
                    { data: profileData, error: profileError },
                    { data: clubsData, error: clubsError },
                ] = await Promise.all([
                    supabase
                        .from("profiles")
                        .select("id, username, bow_type, category, experience, created_at, club_id, is_admin, avatar_url, handicap")                        .eq("id", user.id)
                        .maybeSingle(),
                    supabase.from("clubs").select("id, name, location, description"),
                ]);

                if (profileError) console.error("Profile fetch error:", profileError);
                if (clubsError) console.error("Clubs fetch error:", clubsError);

                if (profileData) {
                    setProfile(profileData);
                    setForm({
                        bow_type: profileData.bow_type ?? "",
                        category: profileData.category ?? "",
                        experience: profileData.experience ?? "",
                        avatar_url: profileData.avatar_url ?? "",
                        handicap: profileData.handicap ?? 0,
                        club_id: profileData.club_id ?? "",
                    });

                    if (profileData.club_id) {
                        const { data: clubData } = await supabase
                            .from("club_member_counts")
                            .select("*")
                            .eq("club_id", profileData.club_id)
                            .maybeSingle();

                        setClubInfo(clubData ?? null);
                    }
                }

                setClubs(clubsData ?? []);
            } catch (err) {
                console.error("Error fetching profile:", err);
                toast.error("Failed to load profile.");
            } finally {
                setLoading(false);
            }
        }

        fetchAll();
    }, [supabase, user]);

    // 🔄 Auth listener
    useEffect(() => {
        if (!supabase) return;

        const { data: listener } = supabase.auth.onAuthStateChange(
            (event: AuthChangeEvent, session: Session | null) => {
                if (event === "SIGNED_OUT") {
                    setUser(null);
                    router.replace("/login");
                } else if (event === "SIGNED_IN") {
                    setUser(session?.user ?? null);
                }
            }
        );

        return () => listener.subscription.unsubscribe();
    }, [supabase, router]);

    // 🚪 Logout
    async function handleLogout() {
        if (!supabase) return;
        setSigningOut(true);
        await fetch("/logout", { method: "POST" });
        setSigningOut(false);
        router.replace("/login");
    }

    // 💾 Save profile edits
    async function handleSave() {
        if (!supabase || !user) return;
        setSaving(true);

        const { error } = await supabase
            .from("profiles")
            .update({
                bow_type: form.bow_type,
                category: form.category,
                experience: form.experience,
                avatar_url: form.avatar_url,
                handicap: form.handicap,
                club_id: form.club_id || null,
            })
            .eq("id", user.id);

        if (error) {
            console.error("Profile update error:", error);
            toast.error("Failed to update profile.");
        } else {
            toast.success("Profile updated!");
            setProfile({
                ...profile!,
                ...form,
            });
            setEditing(false);

            // Refresh club info
            if (form.club_id) {
                const { data: clubData } = await supabase
                    .from("club_member_counts")
                    .select("*")
                    .eq("club_id", form.club_id)
                    .maybeSingle();
                setClubInfo(clubData ?? null);
            } else {
                setClubInfo(null);
            }
        }

        setSaving(false);
    }

    if (!supabase) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center">
                <p className="text-muted-foreground">Preparing dashboard...</p>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center">
                <p className="text-muted-foreground">Loading profile...</p>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center space-y-6">
            <h1 className="text-2xl font-bold">
                Welcome back, {profile?.username || "Archer"}!
            </h1>

            {/* Profile Card */}
            <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))] p-6 text-sm shadow-sm space-y-3">
                <h2 className="text-lg font-semibold mb-2">🎯 Your Profile</h2>

                {profile?.avatar_url ? (
                    <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        width={80}
                        height={80}
                        className="rounded-full border border-[hsl(var(--border))] mx-auto mb-3 object-cover"
                    />
                ) : (
                    <div className="h-20 w-20 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-gray-500 mb-3">
                        ?
                    </div>
                )}

                {editing ? (
                    <>
                        <label className="block text-sm mb-1">Club</label>
                        <select
                            value={form.club_id}
                            onChange={(e) => setForm({ ...form, club_id: e.target.value })}
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                        >
                            <option value="">— No Club —</option>
                            {clubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                    {club.name} {club.location ? `(${club.location})` : ""}
                                </option>
                            ))}
                        </select>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                className="flex-1 rounded-md border border-[hsl(var(--border))] py-2 font-medium hover:bg-[hsl(var(--muted))]/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p>
                            <strong>Email:</strong> {user?.email ?? "Unknown"}
                        </p>
                        <p>
                            <strong>Club:</strong> {clubInfo ? clubInfo.name : "— No Club —"}
                        </p>
                        <p>
                            <strong>Bow Type:</strong> {profile?.bow_type ?? "—"}
                        </p>
                        <p>
                            <strong>Experience:</strong> {profile?.experience ?? "—"}
                        </p>
                        <p>
                            <strong>Handicap:</strong> {profile?.handicap ?? 0}
                        </p>
                        <p>
                            <strong>Admin:</strong> {profile?.is_admin ? "✅ Yes" : "❌ No"}
                        </p>

                        <button
                            onClick={() => setEditing(true)}
                            className="mt-3 w-full rounded-md border border-[hsl(var(--border))] py-2 font-medium hover:bg-[hsl(var(--muted))]/40"
                        >
                            Edit Profile
                        </button>
                    </>
                )}
            </div>

            {/* Club Info Card */}
            {clubInfo && (
                <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--secondary))]/10 p-5 text-sm shadow-sm space-y-2">
                    <h2 className="text-lg font-semibold">🏹 {clubInfo.name}</h2>
                    {clubInfo.location && <p>📍 {clubInfo.location}</p>}
                    {clubInfo.description && <p>{clubInfo.description}</p>}
                    <p>
                        👥 <strong>{clubInfo.member_count ?? 0}</strong> members
                    </p>
                </div>
            )}

            <button
                onClick={handleLogout}
                disabled={signingOut}
                className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-all disabled:opacity-60"
            >
                {signingOut ? "Signing out..." : "Sign Out"}
            </button>
        </main>
    );
}