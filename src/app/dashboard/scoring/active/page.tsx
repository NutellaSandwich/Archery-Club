"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Delete } from "lucide-react";

type ScoringConfig = {
    round: {
        id?: string;
        name: string;
        total_arrows: number;
    };
    arrowsPerEnd: number;
    useTargetFace: boolean;
    isTripleSpot?: boolean;
};

type ArrowInput = number | "M" | "X";

export default function ActiveScoringPage() {
    const router = useRouter();

    const [config, setConfig] = useState<ScoringConfig | null>(null);
    const [currentEnd, setCurrentEnd] = useState(1);
    const [ends, setEnds] = useState<ArrowInput[][]>([]);
    const [currentArrows, setCurrentArrows] = useState<ArrowInput[]>([]);
    const [editingEndIndex, setEditingEndIndex] = useState<number | null>(null);
    const [roundComplete, setRoundComplete] = useState(false);

    const shownRoundCompleteToast = useRef(false);

    const totalEnds = config ? config.round.total_arrows / config.arrowsPerEnd : 0;

    // 🔹 Load config
    useEffect(() => {
        const stored = sessionStorage.getItem("scoringConfig");
        if (!stored) {
            router.push("/dashboard/scoring");
            return;
        }
        setConfig(JSON.parse(stored));
    }, [router]);

    const isWorcester = config?.round?.name?.toLowerCase().includes("worcester");

    // 🎯 Define available scoring values
    const arrowValues: ArrowInput[] = isWorcester
        ? config?.isTripleSpot
            ? [5, 4, 3, "M"] // triple Worcester (only 3–5)
            : [5, 4, 3, 2, 1, "M"] // single Worcester
        : config?.isTripleSpot
            ? ["X", 10, 9, 8, 7, 6, "M"]
            : ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "M"];

    // 🎨 Colour map (with Worcester-specific override)
    // 🎨 Colour map (with Worcester-specific override)
    const getScoreColor = (val: ArrowInput) => {
        if (isWorcester) {
            switch (val) {
                case 5:
                case 4:
                    return "bg-white text-black border";
                case 3:
                case 2:
                case 1:
                    return "bg-black text-white";
                case "M":
                    return "bg-[#2ECC40] text-black"; // ✅ Misses are green now
                default:
                    return "bg-muted/30";
            }
        } else {
            switch (val) {
                case "X":
                case 10:
                case 9:
                case 8:
                    return "bg-yellow-400 text-black";
                case 7:
                case 6:
                    return "bg-red-500 text-white";
                case 5:
                case 4:
                    return "bg-blue-500 text-white";
                case 3:
                case 2:
                    return "bg-black text-white";
                case 1:
                    return "bg-white text-black border";
                case "M":
                    return "bg-[#2ECC40] text-black"; // ✅ Misses are green now
                default:
                    return "bg-muted/30";
            }
        }
    };

    // 🏹 Handle arrow click
    const handleArrowClick = (val: ArrowInput) => {
        const perEnd = config?.arrowsPerEnd || 3;
        if (currentArrows.length >= perEnd) return;
        setCurrentArrows((prev) => [...prev, val]);
    };

    // 💾 Save or update an end
    const handleSaveEnd = () => {
        const perEnd = config?.arrowsPerEnd || 3;
        if (currentArrows.length !== perEnd) {
            toast.error(`Enter all ${perEnd} arrows first.`);
            return;
        }

        const updated = [...ends];

        if (editingEndIndex !== null) {
            updated[editingEndIndex] = [...currentArrows];
            setEditingEndIndex(null);
        } else {
            updated.push(currentArrows);
            setCurrentEnd((prev) => prev + 1);
        }

        setEnds(updated);
        setCurrentArrows([]);

        if (updated.length >= totalEnds && !shownRoundCompleteToast.current) {
            shownRoundCompleteToast.current = true;
            setRoundComplete(true);
            toast.success("Round complete! Review your scores before submitting.");
        }
    };

    // ↩️ Undo last arrow
    const handleUndo = () => {
        setCurrentArrows((prev) => prev.slice(0, -1));
    };

    // ✏️ Edit an end
    const handleEditEnd = (index: number) => {
        setEditingEndIndex(index);
        setCurrentArrows([...ends[index]]);
        setCurrentEnd(index + 1);
    };

    // 🧮 Totals
    const totalScore = ends
        .flat()
        .reduce<number>(
            (acc, v) => acc + (typeof v === "number" ? v : v === "X" ? 10 : 0),
            0
        );

    const golds = isWorcester
        ? 0
        : ends.flat().filter((v) => v === 10 || v === "X").length;

    // ✅ Auto-save full end
    useEffect(() => {
        const perEnd = config?.arrowsPerEnd || 3;
        if (
            currentArrows.length === perEnd &&
            editingEndIndex === null &&
            !roundComplete
        ) {
            const t = setTimeout(() => handleSaveEnd(), 250);
            return () => clearTimeout(t);
        }
    }, [currentArrows, editingEndIndex, config, roundComplete]);

    // 🚀 Final submission handler
    const handleSubmitRound = () => {
        if (!config) return;

        const summaryData = {
            roundName: config.round.name,
            total: totalScore,
            golds,
            hits: ends.flat().filter((v) => v !== "M").length,
            ends,
            arrowsPerEnd: config.arrowsPerEnd,
            isTripleSpot: config.isTripleSpot ?? false,
        };

        localStorage.setItem("lastScoreData", JSON.stringify(summaryData));
        router.push("/dashboard/scoring/summary");
    };

    if (!config) {
        return (
            <main className="flex items-center justify-center min-h-screen text-muted-foreground">
                <p>Loading scoring setup...</p>
            </main>
        );
    }

    const canInputNewEnd =
        !roundComplete && ends.length < totalEnds && editingEndIndex === null;

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">{config.round.name}</h1>
                <p className="text-sm text-muted-foreground">
                    End {currentEnd} of {totalEnds}
                </p>
            </div>

            {/* 🔢 Arrow Input Buttons (only visible for editing or active input) */}
            {(canInputNewEnd || editingEndIndex !== null) && (
                <div className="grid grid-cols-6 gap-2">
                    {arrowValues.map((val) => (
                        <Button
                            key={val}
                            onClick={() => handleArrowClick(val)}
                            className={`py-4 text-lg font-semibold ${getScoreColor(
                                val
                            )} hover:opacity-80`}
                        >
                            {val}
                        </Button>
                    ))}
                </div>
            )}

            {/* 🏹 Current End — only shown if editing or adding */}
            {(canInputNewEnd || editingEndIndex !== null) && (
                <div className="border rounded-lg p-4 mt-4">
                    <h3 className="font-medium mb-2">
                        {editingEndIndex !== null
                            ? `Editing End ${editingEndIndex + 1}`
                            : `Current End`}
                    </h3>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                            {Array.from({ length: config.arrowsPerEnd }).map((_, i) => {
                                const val = currentArrows[i];
                                return (
                                    <div
                                        key={i}
                                        onClick={() => {
                                            if (val) {
                                                setCurrentArrows((prev) => {
                                                    const updated = [...prev];
                                                    updated.splice(i, 1);
                                                    return updated;
                                                });
                                            }
                                        }}
                                        className={`w-10 h-10 flex items-center justify-center rounded-md border text-lg font-semibold cursor-pointer transition ${val
                                                ? `${getScoreColor(val)} hover:opacity-75`
                                                : "bg-muted/30 cursor-default"
                                            }`}
                                    >
                                        {val ?? "-"}
                                    </div>
                                );
                            })}
                        </div>

                        {currentArrows.length > 0 && (
                            <button
                                onClick={handleUndo}
                                className="text-red-500 hover:text-red-700 transition"
                            >
                                <Delete size={22} />
                            </button>
                        )}
                    </div>

                    <div className="flex justify-end mt-4">
                        <Button onClick={handleSaveEnd}>
                            {editingEndIndex !== null ? "Save Changes" : "Save End"}
                        </Button>
                    </div>
                </div>
            )}

            {/* 📋 Saved Ends */}
            {ends.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                    <h3 className="font-medium">Saved Ends</h3>
                    {[...ends]
                        .map((end, i): [ArrowInput[], number] => [end, i])
                        .reverse()
                        .map(([end, i]) => (
                            <div
                                key={i}
                                className="flex justify-between items-center border-b py-1 text-sm cursor-pointer hover:bg-muted/40 rounded-md px-2"
                                onClick={() => handleEditEnd(i)}
                            >
                                <span>
                                    End {i + 1}:{" "}
                                    {end.map((val, j) => (
                                        <span
                                            key={j}
                                            className={`inline-block w-6 h-6 text-center rounded-md mr-1 ${getScoreColor(
                                                val
                                            )}`}
                                        >
                                            {val}
                                        </span>
                                    ))}
                                </span>
                                <span className="font-semibold">
                                    Total:{" "}
                                    {end.reduce(
                                        (a: number, v: ArrowInput) =>
                                            a + (typeof v === "number" ? v : v === "X" ? 10 : 0),
                                        0
                                    )}
                                </span>
                            </div>
                        ))}
                </div>
            )}

            {/* ✅ Review + Submit */}
            {roundComplete && (
                <div className="text-center space-y-4">
                    <p className="text-lg font-semibold">
                        Round Complete! Total: {totalScore}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        You can still edit your ends before submitting.
                    </p>
                    <Button className="mt-2 px-8" onClick={handleSubmitRound}>
                        Complete
                    </Button>
                </div>
            )}
        </main>
    );
}