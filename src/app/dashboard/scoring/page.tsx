"use client";

import { useState, useMemo, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BowArrow } from "lucide-react";

// ✅ Round max scores from NewScorePage
export const ROUND_MAX_SCORES: Record<string, number> = {
    "AGB 900-30": 900,
    "AGB 900-40": 900,
    "AGB 900-50": 900,
    "AGB 900-70": 900,
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
    "WA 1440 (90m)": 1440,
    "WA 1440 (60m) / Metric II": 1440,
    "WA 900": 900,
    "WA 70m": 720,
    "WA 60m": 720,
    "WA 50m (Compound)": 720,
    "WA 50m (Barebow) / Metric 122-50": 720,
    "WA Standard Bow": 720,
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

type Round = {
    name: string;
    total_arrows: number;
    arrows_per_end: number;
    supports_triple: boolean;
};

const TRIPLE_SPOT_ROUNDS = [
    "Bray I",
    "Bray II",
    "Portsmouth",
    "WA 25m",
    "Worcester",
    "Vegas300",
];

export default function ScoringSetupPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);

    const [rounds, setRounds] = useState<Round[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
    const [selectedRound, setSelectedRound] = useState<Round | null>(null);

    const [useTargetFace, setUseTargetFace] = useState(false);
    const [isTripleSpot, setIsTripleSpot] = useState(false);

    const [userCategory, setUserCategory] = useState<string | null>(null);
    const [userExperience, setUserExperience] = useState<string | null>(null);
    const [hasClub, setHasClub] = useState<boolean>(true); // ✅ default true until checked

    // 🧠 Load user category & experience
    useEffect(() => {
        async function loadProfile() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("profiles")
                .select("category, experience, club_id") // ✅ include club_id
                .eq("id", user.id)
                .single();

            if (!error) {
                setUserCategory(data?.category ?? null);
                setUserExperience(data?.experience ?? null);
                setHasClub(!!data?.club_id); // ✅ new state for club membership
            }
        }

        loadProfile();
    }, [supabase]);

    // 🏹 Load rounds with accurate data
    useEffect(() => {
        async function loadRounds() {
            const { data, error } = await supabase.rpc("get_distinct_rounds");

            if (error) {
                console.error("Error loading rounds:", error);
                toast.error("Failed to load round names.");
                return;
            }

            const roundNames = (data as { round_name: string | null }[] || [])
                .map((r) => r.round_name?.trim())
                .filter((r): r is string => typeof r === "string" && r.length > 0)
                .sort();

            const buildRoundData: Round[] = roundNames.map((name) => {
                const maxScore = ROUND_MAX_SCORES[name] ?? 600;
                const total_arrows = maxScore / 10;

                // 🎯 Detect round type
                const isIndoor =
                    /portsmouth|bray|vegas|wa 18|wa 25|worcester|stafford/i.test(name);
                const supports_triple = TRIPLE_SPOT_ROUNDS.includes(name);

                // 🧮 Handle arrows per end
                let arrows_per_end: number;
                if (/worcester/i.test(name)) arrows_per_end = 5;
                else arrows_per_end = isIndoor ? 3 : 6;

                return {
                    name,
                    total_arrows,
                    arrows_per_end,
                    supports_triple,
                };
            });

            setRounds(buildRoundData);
        }

        loadRounds();
    }, [supabase]);

    // 🔍 Autofilter rounds based on search
    useEffect(() => {
        const search = searchTerm.toLowerCase();
        setFilteredRounds(
            rounds.filter((r) => r.name.toLowerCase().includes(search))
        );
    }, [searchTerm, rounds]);

    // ⚙️ Handle round selection
    const handleSelectRound = (round: Round) => {
        setSelectedRound(round);
        setSearchTerm(round.name);
        setFilteredRounds([]);
        setIsTripleSpot(false);
    };

    const totalEnds = selectedRound
        ? Math.ceil(selectedRound.total_arrows / selectedRound.arrows_per_end)
        : 0;

    // ▶️ Go to scoring view
    const handleStartScoring = () => {
        if (!selectedRound) {
            toast.error("Please select a valid round from the list.");
            return;
        }

        const config = {
            round: selectedRound,
            arrowsPerEnd: selectedRound.arrows_per_end,
            useTargetFace,
            isTripleSpot,
            userCategory,
            userExperience,
        };

        sessionStorage.setItem("scoringConfig", JSON.stringify(config));
        window.location.href = "/dashboard/scoring/active";
    };

    if (!hasClub) {
        return (
            <main className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                    <BowArrow className="w-8 h-8" />
                    <h1 className="text-2xl font-semibold">Club Membership Required</h1>
                </div>
                <p className="max-w-md text-muted-foreground">
                    You need to be part of a club to access coaching tools. Please join or request to join a
                    club first from the main page.
                </p>
                <Button onClick={() => (window.location.href = "/")}>Join a club</Button>
            </main>
        );
    }

    return (
        <main className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold text-center">Start Scoring</h1>

            {/* 🔤 Round search & select */}
            <div className="relative">
                <label className="block text-sm mb-1">Round</label>
                <Input
                    placeholder="Type round name..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setSelectedRound(null);
                    }}
                    onFocus={() => {
                        if (searchTerm) {
                            setFilteredRounds(
                                rounds.filter((r) =>
                                    r.name.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                            );
                        }
                    }}
                />
                {filteredRounds.length > 0 && (
                    <div className="absolute z-10 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))]/50 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                        {filteredRounds.map((r) => (
                            <button
                                key={r.name}
                                onClick={() => handleSelectRound(r)}
                                className={`block w-full text-left px-3 py-2 text-sm transition ${selectedRound?.name === r.name
                                        ? "bg-[hsl(var(--muted))]/40 text-[hsl(var(--foreground))]"
                                        : "hover:bg-[hsl(var(--muted))]/30 text-[hsl(var(--foreground))]"
                                    }`}
                            >
                                {r.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedRound && (
                <>
                    {/* 🏹 Options */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={useTargetFace}
                                onChange={(e) => setUseTargetFace(e.target.checked)}
                            />
                            Use interactive target face
                        </label>

                        {selectedRound.supports_triple && (
                            <div>
                                <label className="block text-sm mb-1">Spot Type</label>
                                <select
                                    value={isTripleSpot ? "triple" : "single"}
                                    onChange={(e) => setIsTripleSpot(e.target.value === "triple")}
                                    className="border rounded-md p-2 w-full"
                                >
                                    <option value="single">Single Spot</option>
                                    <option value="triple">Triple Spot</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="mt-4 text-sm text-muted-foreground space-y-1">
                        <p>
                            Round: <strong>{selectedRound.name}</strong>
                        </p>
                        <p>Total arrows: {selectedRound.total_arrows}</p>
                        <p>Ends: {totalEnds}</p>
                        <p>Arrows per end: {selectedRound.arrows_per_end}</p>
                        <p>
                            Spot Type:{" "}
                            {selectedRound.supports_triple
                                ? isTripleSpot
                                    ? "Triple Spot"
                                    : "Single Spot"
                                : "Single Spot"}
                        </p>
                        {userCategory && <p>Category: {userCategory}</p>}
                        {userExperience && <p>Experience: {userExperience}</p>}
                    </div>

                    <Button className="w-full mt-4" onClick={handleStartScoring}>
                        Start Scoring
                    </Button>
                </>
            )}

            {/* Divider */}
            <div className="flex items-center my-8">
                <div className="flex-1 h-px bg-[hsl(var(--border))]/40"></div>
                <span className="px-4 text-sm text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-[hsl(var(--border))]/40"></div>
            </div>

            {/* Submit New Score */}
            <Button
                onClick={() => (window.location.href = "/dashboard/new-score")}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-md transition"
            >
                Submit New Score
            </Button>
        </main>
    );
}