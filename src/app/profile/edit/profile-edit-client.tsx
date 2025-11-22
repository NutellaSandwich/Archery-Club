"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfileEditClient({ userId }: { userId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = supabaseBrowser();

    const targetId = searchParams.get("id") || userId; // ✅ allows admin editing others
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

    const [form, setForm] = useState({
        username: "",
        bow_type: "",
        category: "",
        experience: "",
        club_id: "",
        avatar_url: "",
        agb_number: "", // ✅ new field
    });

    const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    const [showExperienceConfirm, setShowExperienceConfirm] = useState(false);
    const [pendingExperience, setPendingExperience] = useState<string | null>(null);
    const [viewerRole, setViewerRole] = useState<string | null>(null);

    

    useEffect(() => {
        if (!targetId) return;

        async function loadData() {
            try {
                // ✅ Get current viewer role
                const { data: session } = await supabase.auth.getSession();
                const uid = session?.session?.user?.id;

                if (uid) {
                    const { data: viewerProfile } = await supabase
                        .from("profiles")
                        .select("role")
                        .eq("id", uid)
                        .maybeSingle();

                    setViewerRole(viewerProfile?.role ?? null);
                }

                // ✅ Then load target profile
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("username, bow_type, category, experience, club_id, avatar_url, agb_number")
                    .eq("id", targetId)
                    .maybeSingle();

                if (error) throw error;

                setForm({
                    username: profile?.username ?? "",
                    bow_type: profile?.bow_type ?? "Recurve",
                    category: profile?.category ?? "Open",
                    experience: profile?.experience ?? "Novice",
                    club_id: profile?.club_id ?? "",
                    avatar_url: profile?.avatar_url ?? "",
                    agb_number: profile?.agb_number ?? "",
                });
            } catch (err) {
                console.error("Load error:", err);
                toast.error("Failed to load profile.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [supabase, userId]);

    const handleExperienceChange = (newExperience: string) => {
        if (form.experience === "Experienced" && newExperience === "Novice") {
            if (viewerRole === "admin") {
                setPendingExperience(newExperience);
                setShowExperienceConfirm(true);
                return;
            } else {
                toast.error("You cannot revert back to Novice once marked Experienced.");
                return;
            }
        }

        if (form.experience === "Novice" && newExperience === "Experienced") {
            setPendingExperience(newExperience);
            setShowExperienceConfirm(true);
            return;
        }

        setForm({ ...form, experience: newExperience });
    };

    // 📸 Handle avatar upload
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file.");
            return;
        }
        setNewAvatarFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    async function confirmRemoveAvatar() {
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ avatar_url: null })
                .eq("id", targetId);

            if (error) throw error;

            setForm((prev) => ({ ...prev, avatar_url: "" }));
            setPreviewUrl(null);
            setNewAvatarFile(null);
            setFileInputKey((k) => k + 1); // 🔹 Reset input
            toast.success("Profile picture removed!");
        } catch (err) {
            console.error("Remove avatar error:", err);
            toast.error("Failed to remove profile picture.");
        } finally {
            setShowRemoveConfirm(false);
        }
    }

    // 💾 Save
    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        let avatar_url = form.avatar_url;

        try {
            if (newAvatarFile) {
                const { data: auth } = await supabase.auth.getSession();
                const uid = auth?.session?.user?.id;
                if (!uid) throw new Error("User not authenticated");

                const fileExt = newAvatarFile.name.split(".").pop();
                const filePath = `${uid}/${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from("avatars")
                    .upload(filePath, newAvatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from("avatars")
                    .getPublicUrl(filePath);

                avatar_url = publicUrlData.publicUrl;
            }

            const { error } = await supabase
                .from("profiles")
                .update({
                    username: form.username.trim(),
                    bow_type: form.bow_type,
                    category: form.category,
                    experience: form.experience,
                    avatar_url,
                    agb_number: form.agb_number?.trim() || null, // ✅ save AGB number
                })
                .eq("id", targetId);

            if (error) throw error;

            toast.success("Profile updated!");
            router.push(`/profile/${targetId}`);
        } catch (err) {
            console.error("Save error:", err);
            toast.error("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    }



    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center text-muted-foreground">
                <p>Loading profile...</p>
            </main>
        );
    }

    return (
        <main className="relative max-w-xl mx-auto mt-16 px-6 py-10 rounded-2xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm space-y-6">
            <h1 className="text-2xl font-semibold text-center">Edit Profile</h1>

            {/* 🖼️ Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[hsl(var(--primary))]/30">
                    <Image
                        src={previewUrl || form.avatar_url || "/default-avatar.png"}
                        alt="Profile Avatar"
                        fill
                        sizes="128px"
                        className="object-cover"
                    />
                </div>

                <div className="flex flex-col items-center gap-1">
                    <label
                        className="text-sm font-medium text-[hsl(var(--primary))] cursor-pointer hover:underline"
                    >
                        <input
                            key={fileInputKey} // 🔹 Forces re-render after reset
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                        Change Profile Picture
                    </label>

                    {(form.avatar_url || previewUrl) && (
                        <button
                            type="button"
                            onClick={() => setShowRemoveConfirm(true)}
                            className="text-xs text-red-500 hover:underline"
                        >
                            Remove Picture
                        </button>
                    )}
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-sm mb-1">Full Name</label>
                    <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm mb-1">Bow Type</label>
                    <select
                        value={form.bow_type}
                        onChange={(e) => setForm({ ...form, bow_type: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                    >
                        <option>Recurve</option>
                        <option>Compound</option>
                        <option>Barebow</option>
                        <option>Longbow</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm mb-1">Category</label>
                    <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                    >
                        <option>Open</option>
                        <option>Women</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm mb-1">Experience</label>
                    <select
                        value={form.experience}
                        onChange={(e) => handleExperienceChange(e.target.value)}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                    >
                        <option>Novice</option>
                        <option>Experienced</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm mb-1">AGB Number</label>
                    <input
                        type="text"
                        value={form.agb_number}
                        onChange={(e) => setForm({ ...form, agb_number: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20 px-3 py-2"
                        placeholder="Enter AGB number"
                    />
                </div>

                <div className="flex justify-between gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => router.push(`/profile/${targetId}`)}
                        className="flex-1 rounded-md border border-[hsl(var(--border))]/40 py-2 hover:bg-[hsl(var(--muted))]/40"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 font-medium hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>

            {/* 🧱 Remove Picture Confirmation Modal */}
            <AnimatePresence>
                {showRemoveConfirm && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRemoveConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 rounded-xl p-6 shadow-lg max-w-sm w-full text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-semibold mb-2">Remove Profile Picture?</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                This will permanently remove your profile picture.
                            </p>

                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => setShowRemoveConfirm(false)}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRemoveAvatar}
                                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition"
                                >
                                    Remove
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            <AnimatePresence>
                {showExperienceConfirm && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowExperienceConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))]/40 rounded-xl p-6 shadow-lg max-w-sm w-full text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-semibold mb-2">
                                Confirm Experience Change
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                {pendingExperience === "Novice"
                                    ? "Are you sure you want to revert this archer to Novice?"
                                    : "Are you sure you want to mark this archer as Experienced? This cannot be undone."}
                            </p>

                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => {
                                        setShowExperienceConfirm(false);
                                        setPendingExperience(null);
                                    }}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setForm({ ...form, experience: pendingExperience || form.experience });
                                        setShowExperienceConfirm(false);
                                        setPendingExperience(null);
                                        toast.success("Experience updated.");
                                    }}
                                    className="px-4 py-2 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}