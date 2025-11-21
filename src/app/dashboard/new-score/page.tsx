"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";
import confettiLib from "canvas-confetti";


function RoundNameSelect({ value, onChange }: { value: string; onChange?: (val: string) => void }) {
    const [query, setQuery] = useState(value);
    const [showList, setShowList] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [rounds, setRounds] = useState<string[]>([]);
    const supabase = useMemo(() => supabaseBrowser(), []);

    useEffect(() => {
        async function loadRounds() {
            const { data, error } = await supabase.rpc("get_distinct_rounds");

            if (error) {
                console.error("Error loading rounds:", error);
                return;
            }

            const uniqueRounds = (data || [])
                .map((r: { round_name: string | null }) => r.round_name?.trim())
                .filter((r: string | null | undefined): r is string => typeof r === "string" && r.length > 0)
                .sort();

            setRounds(uniqueRounds);
        }

        loadRounds();
    }, [supabase]);

    const filteredRounds = useMemo(() => {
        if (!query) return rounds;
        return rounds.filter((round) =>
            round.toLowerCase().includes(query.toLowerCase())
        );
    }, [query, rounds]);

    const handleSelect = (val: string) => {
        setQuery(val);
        setShowList(false);
        setIsValid(true);
        if (onChange) onChange(val);
    };

    const handleBlur = () => {
        const matched = rounds.some(
            (r) => r.toLowerCase() === query.trim().toLowerCase()
        );
        if (!matched) {
            setIsValid(false);
            setQuery("");
            if (onChange) onChange("");
        } else {
            setIsValid(true);
        }
        setTimeout(() => setShowList(false), 150);
    };

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Start typing a round name..."
                value={query}
                onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                onBlur={handleBlur}
                className={`w-full rounded-md border px-3 py-2 bg-[hsl(var(--muted))]/20 ${isValid
                    ? "border-[hsl(var(--border))]/40"
                    : "border-red-500 focus:border-red-500"
                    }`}
            />
            {showList && filteredRounds.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm">
                    {filteredRounds.map((round) => (
                        <li
                            key={round}
                            onMouseDown={() => handleSelect(round)}
                            className="px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
                        >
                            {round}
                        </li>
                    ))}
                </ul>
            )}
            {!isValid && (
                <p className="text-xs text-red-500 mt-1">
                    Please select a valid round from the list.
                </p>
            )}
        </div>
    );
}

export const ROUND_MAX_SCORES: Record<string, number> = {
    // AGB 900 Rounds
    "AGB 900-30": 900,
    "AGB 900-40": 900,
    "AGB 900-50": 900,
    "AGB 900-70": 900,

    // Traditional Imperial Rounds
    "York": 1440,
    "Hereford / Bristol I": 1440,
    "Bristol II": 1440,
    "Bristol III": 1440,
    "Bristol IV": 1440,
    "Bristol V": 1440,
    "Albion": 972,
    "St George": 972,
    "American": 720,
    "New National": 720,
    "Long National": 720,
    "National": 648,
    "National 50": 648,
    "National 40": 648,
    "National 30": 648,
    "New Western": 864,
    "Long Western": 864,
    "Western": 864,
    "Western 50": 864,
    "Western 40": 864,
    "Western 30": 864,
    "New Warwick": 648,
    "Long Warwick": 648,
    "Warwick": 648,
    "Warwick 50": 648,
    "Warwick 40": 648,
    "St Nicholas": 648,
    "Windsor": 972,
    "Windsor 50": 972,
    "Windsor 40": 972,
    "Windsor 30": 972,

    // Metric (Outdoor) Rounds
    "Metric 122-30": 720,
    "Metric 122-40": 720,
    "Metric 80-40": 720,
    "Metric III": 1440,
    "Metric IV": 1440,
    "Metric V": 1440,
    "Short Metric": 720,
    "Short Metric I": 720,
    "Short Metric II": 720,
    "Short Metric III": 720,
    "Short Metric IV": 720,
    "Short Metric V": 720,
    "Long Metric (Men)": 1440,
    "Long Metric (Women) / 1": 1440,
    "Long Metric II": 1440,
    "Long Metric III": 1440,
    "Long Metric IV": 1440,
    "Long Metric V": 1440,

    // WA & Metric Combined
    "WA 1440 (90m)": 1440,
    "WA 1440 (60m) / Metric II": 1440,
    "WA 900": 900,
    "WA 70m": 720,
    "WA 60m": 720,
    "WA 50m (Compound)": 720,
    "WA 50m (Barebow) / Metric 122-50": 720,
    "WA Standard Bow": 720,

    // Indoor Rounds
    "Portsmouth": 600,
    "Worcester": 300,
    "Stafford": 600,
    "Bray I": 300,
    "Bray II": 300,
    "WA 18m": 600,
    "WA 25m": 600,
    "WA 18m or Vegas": 600,
    "Vegas300": 300,
};

export default function NewScorePage() {
    const router = useRouter();
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [form, setForm] = useState({
        round_name: "",
        bow_type: "Recurve",
        category: "Open",
        experience: "Experienced",
        spot_type: "",
        score: "",
        golds: "",
        score_date: new Date().toISOString().split("T")[0],
        score_type: "Informal Practice",
        competition_name: "",
        scoresheet: null as File | null,
    });

    const [roundData, setRoundData] = useState<
        { round_name: string; max_score: number; spot_types: string[] }[]
    >([]);
    const [availableSpotTypes, setAvailableSpotTypes] = useState<string[]>([]);
    const [roundMaxScore, setRoundMaxScore] = useState<number | null>(null);
    const [showCompetitionModal, setShowCompetitionModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isFormalOrCompetition =
        form.score_type === "Formal Practice" || form.score_type === "Competition";

    // ✅ Load all round data — ONLY use static ROUND_MAX_SCORES for max scores
    useEffect(() => {
        async function loadRoundData() {
            console.log("📦 Building round data from ROUND_MAX_SCORES...");

            const cached = localStorage.getItem("handicaps_cache_static");
            if (cached) {
                console.log("⚡ Loaded round data from cache");
                setRoundData(JSON.parse(cached));
                return;
            }

            // Fetch all handicap data just to get round names + spot types (not scores)
            const { data, error } = await supabase
                .from("handicaps")
                .select("round_name, spot_type");

            if (error) {
                console.error("❌ Error loading handicap table:", error);
                return;
            }

            const grouped = (data || []).reduce((acc: Record<string, Set<string>>, row: {
                round_name?: string | null;
                spot_type?: string | null;
            }) => {
                const name = row.round_name?.trim();
                if (!name) return acc;
                if (!acc[name]) acc[name] = new Set<string>();

                const s = row.spot_type?.toLowerCase();
                if (s?.includes("triple")) acc[name].add("triple");
                else acc[name].add("full size");

                return acc;
            }, {} as Record<string, Set<string>>);

            // Combine with static max scores
            const results: { round_name: string; max_score: number; spot_types: string[] }[] =
                Object.keys(ROUND_MAX_SCORES).map((name) => ({
                    round_name: name,
                    max_score: ROUND_MAX_SCORES[name],
                    spot_types: Array.from(grouped[name] || ["full size"]) as string[],
                }));

            console.log(`✅ Loaded ${results.length} static round records`);
            localStorage.setItem("handicaps_cache_static", JSON.stringify(results));
            setRoundData(results);
        }

        loadRoundData();
    }, [supabase]);

    // ✅ Update available spot types & max score when round changes
    useEffect(() => {
        const normalizeName = (s: string) =>
            s.toLowerCase()
                .replace(/[\s,()]+/g, " ")
                .replace(/\b(triple|full|size|spot)\b/g, "")
                .trim();

        const roundInfo = roundData.find(
            (r) => normalizeName(r.round_name) === normalizeName(form.round_name)
        );

        console.log("Current roundInfo:", roundInfo); // 🧠 Debug

        if (roundInfo) {
            const normalizeSpot = (s: string): "triple" | "full size" => {
                const clean = s.toLowerCase().replace(/\s+/g, "");
                if (clean.includes("triple")) return "triple";
                if (clean.includes("3spot")) return "triple";
                if (clean.includes("single")) return "full size";
                if (clean.includes("full")) return "full size";
                return "full size";
            };

            const spots = roundInfo.spot_types.map(normalizeSpot);
            const uniqueSpots = Array.from(new Set(spots));

            console.log("Detected spots:", uniqueSpots); // 🧠 Debug

            setAvailableSpotTypes(uniqueSpots);
            setRoundMaxScore(roundInfo.max_score);

            if (uniqueSpots.length === 1) {
                setForm((prev) => ({ ...prev, spot_type: uniqueSpots[0] }));
            } else {
                setForm((prev) => ({ ...prev, spot_type: "" }));
            }
        } else {
            setAvailableSpotTypes([]);
            setRoundMaxScore(null);
        }
    }, [form.round_name, roundData]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        if (!supabase) {
            toast.error("Supabase client not ready.");
            setSubmitting(false);
            return;
        }

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            const user = session?.user;
            if (!user) {
                toast.error("You must be logged in to submit a score.");
                router.push("/login");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("club_id, category, experience")
                .eq("id", user.id)
                .single();

            if (profileError) {
                toast.error("Could not find your profile.");
                setSubmitting(false);
                return;
            }

            if (!profile?.club_id) {
                toast.error("You need to join a club before submitting a score.");
                setSubmitting(false);
                return;
            }

            // ✅ Require scoresheet for formal/competition
            if (isFormalOrCompetition && !form.scoresheet) {
                toast.error("A scoresheet is required for this type of score.");
                setSubmitting(false);
                return;
            }

            // ✅ Upload scoresheet if present
            let scoresheet_url = null;
            if (form.scoresheet) {
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from("scoresheets")
                    .upload(`${user.id}/${Date.now()}_${form.scoresheet.name}`, form.scoresheet);

                if (uploadError) throw uploadError;
                const { data: publicUrlData } = supabase.storage
                    .from("scoresheets")
                    .getPublicUrl(uploadData.path);
                scoresheet_url = publicUrlData.publicUrl;
            }

            // ✅ Validate score limit from handicap data
            if (roundMaxScore && parseInt(form.score) > roundMaxScore) {
                toast.error(`Score exceeds maximum possible for ${form.round_name} (${roundMaxScore}).`);
                setSubmitting(false);
                return;
            }

            // 🧩 Check for personal best BEFORE inserting
            const { data: previousScores, error: prevError } = await supabase
                .from("club_posts")
                .select("score")
                .eq("user_id", user.id)
                .eq("round_name", form.round_name.trim())
                .order("score", { ascending: false })
                .limit(1);

            if (prevError) console.error("❌ Error fetching previous scores:", prevError);

            const bestPrevious = previousScores?.[0]?.score ?? 0;
            const isPersonalBest = parseInt(form.score) > bestPrevious;

            // ✅ Insert new post with personal best flag
            const { data, error } = await supabase
                .from("club_posts")
                .insert([
                    {
                        user_id: user.id,
                        club_id: profile.club_id,
                        round_name: form.round_name.trim(),
                        bow_type: form.bow_type,
                        category: (profile.category || "open").toLowerCase().trim(),
                        experience: (profile.experience || "experienced").toLowerCase().trim(),
                        spot_type: form.spot_type || "Full Size",
                        score: parseInt(form.score),
                        golds: parseInt(form.golds || "0"),
                        score_type: form.score_type,
                        competition_name: form.competition_name || null,
                        scoresheet_url,
                        score_date: form.score_date,
                        is_personal_best: isPersonalBest, // 🟢 New field
                    },
                ])
                .select("is_club_record, is_personal_best");

            if (error) {
                console.error(error);
                toast.error("Failed to submit score.");
            } else {
                toast.success("Score submitted successfully!");
                confettiLib();
                setTimeout(() => router.push("/dashboard"), 1000);
            }
        } catch (err) {
            console.error("Submit error:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="max-w-md mx-auto mt-12 p-6 rounded-2xl border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm space-y-6">
            <h1 className="text-2xl font-semibold text-center">Submit a Score 🎯</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Round */}
                <div>
                    <label className="block text-sm mb-1">Round</label>
                    <RoundNameSelect
                        value={form.round_name}
                        onChange={(val) => setForm({ ...form, round_name: val })}
                    />
                </div>

                {/* ✅ Spot Type */}
                {availableSpotTypes.length > 1 && (
                    <div>
                        <label className="block text-sm mb-1">Spot Type</label>
                        <select
                            value={form.spot_type}
                            onChange={(e) => setForm({ ...form, spot_type: e.target.value })}
                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                        >
                            <option value="">Select Spot Type</option>
                            {availableSpotTypes.map((s) => (
                                <option key={s} value={s}>
                                    {s === "triple" ? "Triple Spot" : "Full Size"}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Bow Type */}
                <div>
                    <label className="block text-sm mb-1">Bow Type</label>
                    <select
                        value={form.bow_type}
                        onChange={(e) => setForm({ ...form, bow_type: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                    >
                        <option>Recurve</option>
                        <option>Compound</option>
                        <option>Barebow</option>
                        <option>Longbow</option>
                    </select>
                </div>

                {/* Score Type */}
                <div>
                    <label className="block text-sm mb-1">Score Type</label>
                    <select
                        value={form.score_type}
                        onChange={(e) => {
                            const value = e.target.value;
                            setForm({ ...form, score_type: value });
                            if (value === "Competition") setShowCompetitionModal(true);
                        }}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                    >
                        <option>Informal Practice</option>
                        <option>Formal Practice</option>
                        <option>Competition</option>
                    </select>
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm mb-1">Date</label>
                    <input
                        type="date"
                        value={form.score_date}
                        onChange={(e) => setForm({ ...form, score_date: e.target.value })}
                        className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                    />
                </div>

                {/* Score + Golds */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <input
                            type="number"
                            placeholder="Score"
                            value={form.score}
                            onChange={(e) => {
                                const val = e.target.value;
                                const max = roundMaxScore || null;
                                if (max && parseInt(val) > max) {
                                    toast.error(`${form.round_name} has a maximum score of ${max}.`);
                                    return;
                                }
                                setForm({ ...form, score: val });
                            }}
                            className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                            required
                            min="0"
                            max={roundMaxScore || undefined}
                        />
                        {form.round_name && roundMaxScore && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Max: {roundMaxScore}
                            </p>
                        )}
                    </div>

                    <input
                        type="number"
                        placeholder="Golds (optional)"
                        value={form.golds}
                        onChange={(e) => setForm({ ...form, golds: e.target.value })}
                        className="rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
                    />
                </div>

                {/* Scoresheet Upload */}
                <div>
                    <label className="block text-sm mb-1">
                        Scoresheet {isFormalOrCompetition ? "(required)" : "(optional)"}
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                            setForm({ ...form, scoresheet: e.target.files?.[0] || null })
                        }
                        className="w-full text-sm"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                    {submitting ? "Submitting..." : "Submit Score"}
                </button>
            </form>

            {/* Competition Modal */}
            {showCompetitionModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setShowCompetitionModal(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-xl p-6 shadow-xl w-80"
                    >
                        <h2 className="text-lg font-semibold mb-2">Competition Name</h2>
                        <input
                            type="text"
                            value={form.competition_name}
                            onChange={(e) => setForm({ ...form, competition_name: e.target.value })}
                            placeholder="Enter competition name"
                            className="w-full border rounded-md px-3 py-2 mb-4"
                        />
                        <button
                            className="bg-blue-600 text-white px-4 py-2 rounded-md w-full"
                            onClick={() => setShowCompetitionModal(false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}