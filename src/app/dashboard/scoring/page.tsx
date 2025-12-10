"use client";

import { useState, useMemo, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BowArrow } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    const [spotDropdownOpen, setSpotDropdownOpen] = useState(false);
    const [closingDropdown, setClosingDropdown] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

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

    useEffect(() => {
        if (!rounds.length) return;            // <-- prevents empty results
        if (closingDropdown) return;

        const search = searchTerm.toLowerCase();
        const results = rounds.filter((r) =>
            r.name.toLowerCase().includes(search)
        );

        setFilteredRounds(results);
    }, [searchTerm, rounds, closingDropdown]);

    useEffect(() => {
        if (searchTerm && rounds.length && isTyping) {
            setFilteredRounds(
                rounds.filter((r) =>
                    r.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }
    }, [rounds]);

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
        <main className="max-w-2xl mx-auto p-6 space-y-8">

            {/* PAGE TITLE */}
            <div className="text-center space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-sky-500 bg-clip-text text-transparent">
                    Start Scoring
                </h1>
                <p className="text-sm text-muted-foreground">
                    Choose your round and scoring method
                </p>
            </div>

            {/* SECTION CARD */}
            <section className="rounded-3xl border border-border/70 bg-muted/40 px-5 py-6 shadow-sm space-y-6">

                {/* ROUND SELECT */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.12em]">
                            Select Round
                        </p>
                        <p className="text-xs text-muted-foreground/80 max-w-md">
                            Search and choose a round to begin scoring.
                        </p>
                    </div>

                    <div className="relative">
                        <Input
                            placeholder="Search for a round..."
                            value={searchTerm}
                            onChange={(e) => {
                                setIsTyping(true);
                                setSpotDropdownOpen(false);
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
                            className="pl-9 h-10 rounded-xl border-border/60 bg-background/80 text-sm"
                        />

                        {/* Search Icon */}
                        <BowArrow
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                            size={16}
                        />

                        {/* DROPDOWN */}
                        <AnimatePresence>
                            {isTyping && filteredRounds.length > 0 && searchTerm && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-20 w-full bg-background border border-border/60 rounded-xl mt-2 shadow-lg max-h-60 overflow-auto text-sm"
                                >
                                    {filteredRounds.map((r) => (
                                        <button
                                            key={r.name}
                                            onClick={() => {
                                                setClosingDropdown(true);
                                                handleSelectRound(r);
                                                setFilteredRounds([]);

                                                setTimeout(() => {
                                                    setIsTyping(false);
                                                    setSearchTerm(r.name);
                                                    setClosingDropdown(false);
                                                }, 120);
                                            }}
                                            className={`block w-full text-left px-3 py-2 transition ${selectedRound?.name === r.name
                                                    ? "bg-muted/70 text-primary font-medium"
                                                    : "hover:bg-muted/50"
                                                }`}
                                        >
                                            {r.name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {selectedRound && (
                    <>
                        {/* INPUT METHOD TOGGLE */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.12em]">
                                    Input Method
                                </p>
                            </div>

                            <div className="relative flex items-center w-full bg-muted/20 border border-border/50 rounded-xl p-1">
                                <motion.div
                                    layout
                                    className="absolute top-1 bottom-1 w-1/2 bg-gradient-to-r from-emerald-500 to-sky-500/70 rounded-lg"
                                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                                    animate={{
                                        left: useTargetFace ? "50%" : "0%",
                                    }}
                                />

                                <button
                                    className={`relative z-10 flex-1 py-2 text-sm font-medium transition ${!useTargetFace
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                        }`}
                                    onClick={() => setUseTargetFace(false)}
                                >
                                    Arrow Values
                                </button>

                                <button
                                    className={`relative z-10 flex-1 py-2 text-sm font-medium transition ${useTargetFace
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                        }`}
                                    onClick={() => setUseTargetFace(true)}
                                >
                                    Target Face
                                </button>
                            </div>

                            {/* SPOT TYPE */}
                            {selectedRound.supports_triple && (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.12em]">
                                        Spot Type
                                    </p>

                                    <div className="relative">
                                        <button
                                            onClick={() => setSpotDropdownOpen((o) => !o)}
                                            className="w-full flex justify-between items-center border border-border/50 bg-muted/20 rounded-xl px-3 py-2 text-sm"
                                        >
                                            {isTripleSpot ? "Triple Spot" : "Single Spot"}
                                            <span className="text-muted-foreground">▾</span>
                                        </button>

                                        <AnimatePresence>
                                            {spotDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -5 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute z-20 w-full bg-background border border-border/50 rounded-xl mt-2 shadow-lg overflow-hidden"
                                                >
                                                    <button
                                                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/40"
                                                        onClick={() => {
                                                            setIsTripleSpot(false);
                                                            setSpotDropdownOpen(false);
                                                        }}
                                                    >
                                                        Single Spot
                                                    </button>
                                                    <button
                                                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/40"
                                                        onClick={() => {
                                                            setIsTripleSpot(true);
                                                            setSpotDropdownOpen(false);
                                                        }}
                                                    >
                                                        Triple Spot
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SUMMARY */}
                        <div className="bg-background/50 rounded-xl border border-border/40 p-4 mt-4 space-y-1 text-sm">
                            <p>
                                <span className="font-medium">Round:</span>{" "}
                                {selectedRound.name}
                            </p>
                            <p>Total arrows: {selectedRound.total_arrows}</p>
                            <p>Ends: {totalEnds}</p>
                            <p>Arrows per end: {selectedRound.arrows_per_end}</p>
                            <p>
                                Spot Type:{" "}
                                {isTripleSpot ? "Triple Spot" : "Single Spot"}
                            </p>
                            {userCategory && <p>Category: {userCategory}</p>}
                            {userExperience && <p>Experience: {userExperience}</p>}
                        </div>

                        {/* START BUTTON */}
                        <Button
                            className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-sky-500 text-white hover:opacity-90 rounded-xl py-3"
                            onClick={handleStartScoring}
                        >
                            Start Scoring
                        </Button>
                    </>
                )}
            </section>

            {/* DIVIDER */}
            <div className="flex items-center my-10">
                <div className="flex-1 h-px bg-border/60"></div>
                <span className="px-4 text-sm font-medium text-muted-foreground bg-card rounded-full shadow-sm border border-border/40">
                    or
                </span>
                <div className="flex-1 h-px bg-border/60"></div>
            </div>

            {/* SUBMIT MANUAL SCORE */}
            <button
                onClick={() => (window.location.href = "/dashboard/new-score")}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl px-6 py-3 font-medium shadow-sm transition"
            >
                Submit New Score
            </button>
        </main>
    );}