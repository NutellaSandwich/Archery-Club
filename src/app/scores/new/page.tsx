"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewScorePage() {
    const router = useRouter();
    const supabase = supabaseBrowser();

    const [form, setForm] = useState({
        round_name: "",
        bow_type: "Recurve",
        category: "Open",
        experience: "Experienced",
        score_type: "Practice",
        score: "",
        golds: "",
        distance: "",
        is_outdoor: false,
        image: null as File | null,
    });

    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        console.log("🟢 handleSubmit triggered");
        setSubmitting(true);

        try {
            console.log("Step 1: Getting Supabase session...");
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            const user = session?.user;
            if (!user) throw new Error("Not logged in");
            console.log("✅ Logged in as:", user.email);

            // ---- Upload image if exists ----
            let imageUrl = null;
            if (form.image) {
                console.log("Step 2: Uploading image...");
                const fileExt = form.image.name.split(".").pop();
                const filePath = `scores/${user.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from("score-images")
                    .upload(filePath, form.image);
                if (uploadError) throw uploadError;
                imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/score-images/${filePath}`;
                console.log("✅ Image uploaded to:", imageUrl);
            }

            // ---- Insert score record ----
            console.log("Step 3: Inserting score record...");
            const { error: insertError } = await supabase.from("scores").insert([
                {
                    user_id: user.id,
                    round_name: form.round_name,
                    bow_type: form.bow_type,
                    category: form.category,
                    experience: form.experience,
                    score_type: form.score_type,
                    score: parseInt(form.score),
                    golds: parseInt(form.golds || "0"),
                    distance: form.distance,
                    is_outdoor: form.is_outdoor,
                    image_url: imageUrl,
                },
            ]);

            if (insertError) {
                console.error("❌ Insert error:", insertError);
                throw insertError;
            }

            console.log("✅ Step 4: Insert successful!");
            toast.success("Score submitted!");
            router.push("/dashboard");
        } catch (err: any) {
            console.error("❌ Full error:", err);
            toast.error(`Failed to submit: ${err.message || "Unknown error"}`);
        } finally {
            console.log("🟣 Done — resetting submit state");
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-lg mx-auto mt-10 bg-[hsl(var(--card))] border border-[hsl(var(--border))]/50 rounded-2xl shadow-sm p-6">
            <h1 className="text-xl font-semibold mb-4">Submit New Score</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm mb-1">Round Name</label>
                    <input
                        required
                        type="text"
                        className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                        value={form.round_name}
                        onChange={(e) =>
                            setForm({ ...form, round_name: e.target.value })
                        }
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm mb-1">Bow Type</label>
                        <select
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.bow_type}
                            onChange={(e) =>
                                setForm({ ...form, bow_type: e.target.value })
                            }
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
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.category}
                            onChange={(e) =>
                                setForm({ ...form, category: e.target.value })
                            }
                        >
                            <option>Open</option>
                            <option>Women</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm mb-1">Experience</label>
                        <select
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.experience}
                            onChange={(e) =>
                                setForm({ ...form, experience: e.target.value })
                            }
                        >
                            <option>Experienced</option>
                            <option>Novice</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Score Type</label>
                        <select
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.score_type}
                            onChange={(e) =>
                                setForm({ ...form, score_type: e.target.value })
                            }
                        >
                            <option>Practice</option>
                            <option>Formal</option>
                            <option>Competition</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm mb-1">Score</label>
                        <input
                            required
                            type="number"
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.score}
                            onChange={(e) =>
                                setForm({ ...form, score: e.target.value })
                            }
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Golds</label>
                        <input
                            type="number"
                            className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                            value={form.golds}
                            onChange={(e) =>
                                setForm({ ...form, golds: e.target.value })
                            }
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm mb-1">Distance</label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-[hsl(var(--border))] p-2"
                        value={form.distance}
                        onChange={(e) =>
                            setForm({ ...form, distance: e.target.value })
                        }
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={form.is_outdoor}
                        onChange={(e) =>
                            setForm({ ...form, is_outdoor: e.target.checked })
                        }
                    />
                    <label>Outdoor round?</label>
                </div>

                <div>
                    <label className="block text-sm mb-1">Upload Score Sheet</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                            setForm({ ...form, image: e.target.files?.[0] ?? null })
                        }
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md py-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {submitting ? "Submitting..." : "Submit Score"}
                </button>
            </form>
        </div>
    );
}