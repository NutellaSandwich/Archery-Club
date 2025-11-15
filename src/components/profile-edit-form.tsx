"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Profile editing form with avatar upload, preview, delete, and UX polish.
 */
export function ProfileEditForm({ userId }: { userId: string }) {
    const supabase = supabaseBrowser();
    const [form, setForm] = useState({ full_name: "", username: "", avatar_url: "" });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load profile data
    useEffect(() => {
        async function load() {
            const { data, error } = await supabase
                .from("profiles")
                .select("full_name, username, avatar_url")
                .eq("id", userId)
                .single();

            if (!error && data) {
                setForm(data);
                setPreviewUrl(data.avatar_url || null);
            } else {
                toast.error("Failed to load profile.");
            }
            setLoading(false);
        }
        load();
    }, [supabase, userId]);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }

    async function handleAvatarUpload(file: File) {
        const ext = file.name.split(".").pop();
        const fileName = `${userId}-${Date.now()}.${ext}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error(uploadError);
            toast.error("Failed to upload avatar.");
            return null;
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        return data.publicUrl;
    }

    async function handleAvatarDelete() {
        if (!form.avatar_url) return;

        toast.info("Removing avatar…");

        try {
            const url = new URL(form.avatar_url);
            const parts = url.pathname.split("/avatars/");
            const filePath = parts.length > 1 ? parts[1] : null;

            if (filePath) {
                const { error: deleteError } = await supabase.storage
                    .from("avatars")
                    .remove([filePath]);
                if (deleteError) throw deleteError;
            }

            const { error: dbError } = await supabase
                .from("profiles")
                .update({ avatar_url: null })
                .eq("id", userId);
            if (dbError) throw dbError;

            setAvatarFile(null);
            setPreviewUrl(null);
            setForm({ ...form, avatar_url: "" });
            toast.success("Avatar removed.");
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove avatar.");
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        toast.loading("Saving profile...");

        try {
            let avatarUrl = form.avatar_url;
            if (avatarFile) {
                const uploaded = await handleAvatarUpload(avatarFile);
                if (uploaded) avatarUrl = uploaded;
            }

            // ⬇️ Add .select() to return row data, and log full result
            const { data, error, status } = await supabase
                .from("profiles")
                .update({
                    full_name: form.full_name,
                    username: form.username,
                    avatar_url: avatarUrl,
                })
                .eq("id", userId)
                .select();

            console.log("UPDATE RESPONSE:", { data, error, status });

            if (error) throw error;
            toast.success("Profile updated!");
        } catch (err) {
            console.error("UPDATE ERROR:", err);
            toast.error("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p>Loading…</p>;

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm w-80"
        >
            {/* Avatar preview */}
            <div className="flex flex-col items-center gap-2">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="avatar preview"
                        className="h-24 w-24 rounded-full border object-cover"
                    />
                ) : (
                    <div className="h-24 w-24 rounded-full border flex items-center justify-center text-sm text-muted-foreground">
                        No Avatar
                    </div>
                )}

                <div className="flex gap-2 mt-1">
                    <label className="cursor-pointer text-sm text-blue-600 underline">
                        Change
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>

                    {previewUrl && (
                        <button
                            type="button"
                            onClick={handleAvatarDelete}
                            className="text-sm text-red-600 underline"
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>

            {/* Name fields */}
            <label className="flex flex-col text-left">
                <span className="text-sm text-muted-foreground mb-1">Full Name</span>
                <input
                    className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2"
                    value={form.full_name || ""}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
            </label>

            <label className="flex flex-col text-left">
                <span className="text-sm text-muted-foreground mb-1">Username</span>
                <input
                    className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2"
                    value={form.username || ""}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
            </label>

            <button
                type="submit"
                disabled={saving}
                className={`rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50`}
            >
                {saving ? "Saving..." : "Save Changes"}
            </button>
        </form>
    );
}