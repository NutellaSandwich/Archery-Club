"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Delete } from "lucide-react";
import TargetFaceInput from "@/components/TargetFaceInput"; // adjust path as needed
import { Crosshair, Target } from "lucide-react"; 
import html2canvas from "html2canvas";

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

type TargetFaceArrow = {
    score: ArrowInput;
    xPct: number;   // 0–100 SVG position
    yPct: number;
    faceIndex: number;  // 0–2 for triple spot
};

export default function ActiveScoringPage() {
    const router = useRouter();

    const [config, setConfig] = useState<ScoringConfig | null>(null);
    const [currentEnd, setCurrentEnd] = useState(1);
    type EndData = (ArrowInput | TargetFaceArrow)[];
    const [ends, setEnds] = useState<EndData[]>([]);
    const [currentArrows, setCurrentArrows] = useState<EndData>([]);
    const [editingEndIndex, setEditingEndIndex] = useState<number | null>(null);
    const [roundComplete, setRoundComplete] = useState(false);
    const shownRoundCompleteToast = useRef(false);
    const [showArrowMap, setShowArrowMap] = useState(false);

    const totalEnds = config ? config.round.total_arrows / config.arrowsPerEnd : 0;


    async function renderTargetImage(): Promise<string | null> {
        const targetEl = document.getElementById("active-target-preview");
        if (!targetEl) return null;

        const canvas = await html2canvas(targetEl, {
            backgroundColor: null,
            scale: 3,
            logging: false,
        });

        return canvas.toDataURL("image/png");
    }
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

    const getScoreColor = (val: ArrowInput) => {
        // --- WORCESTER LOGIC (unchanged) ---
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
                    return "bg-[#74c96a] text-black"; // softer bright green
                default:
                    return "bg-muted/30";
            }
        }

        // --- WA TARGET COLOURS (new vivid versions matching target face) ---

        // Yellow (X, 10, 9)
        if (val === "X" || val === 10 || val === 9)
            return "bg-[#f5cc2d] text-black";

        // Red (8, 7)
        if (val === 8 || val === 7)
            return "bg-[#df4b4b] text-white";

        // Blue (6, 5)
        if (val === 6 || val === 5)
            return "bg-[#5e84e0] text-white";

        // Black (4, 3)
        if (val === 4 || val === 3)
            return "bg-[#1f1f1f] text-white";

        // White (2, 1)
        if (val === 2 || val === 1)
            return "bg-white text-black border";

        // Miss
        if (val === "M")
            return "bg-[#74c96a] text-black";

        return "bg-muted/30";
    };

    // 🏹 Handle arrow click
    const handleArrowClick = (val: ArrowInput | TargetFaceArrow) => {
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

    const totalScore = ends
        .flat()
        .reduce<number>((acc, v) => {
            const s = typeof v === "object" ? v.score : v;

            if (s === "X") return acc + 10;
            if (typeof s === "number") return acc + s;
            return acc; // "M" or invalid
        }, 0);

    const golds = isWorcester
        ? 0
        : ends.flat().filter((v) => {
            const s = typeof v === "object" ? v.score : v;
            return s === 10 || s === "X";
        }).length;

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
            hits: ends.flat().filter((v) => {
                const s = typeof v === "object" ? v.score : v;
                return s !== "M";
            }).length,
            ends,
            arrowsPerEnd: config.arrowsPerEnd,
            isTripleSpot: config.isTripleSpot ?? false,
        };

        (async () => {
            const targetImage = await renderTargetImage();

            const finalPayload = {
                ...summaryData,
                targetImage,   // ← ADD THIS FIELD
            };

            localStorage.setItem("lastScoreData", JSON.stringify(finalPayload));
            router.push("/dashboard/scoring/summary");
        })();
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

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArrowMap(true)}
                        className="p-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition flex items-center gap-2"
                        title="Show Arrow Placement Map"
                    >
                        <Target size={22} />
                        <span className="hidden sm:inline text-sm font-medium">Arrow Map</span>
                    </button>

                    <p className="text-sm text-muted-foreground">
                        End {currentEnd} of {totalEnds}
                    </p>
                </div>
            </div>

            {(canInputNewEnd || editingEndIndex !== null) && (
                config.useTargetFace ? (
                    <TargetFaceInput
                        arrowsPerEnd={config.arrowsPerEnd}
                        isTripleSpot={!!config.isTripleSpot}
                        currentArrows={currentArrows as TargetFaceArrow[]}
                        onSelectArrow={(arrow) => handleArrowClick(arrow)}
                    />
                ) : (
                    <div className="grid grid-cols-6 gap-2">
                        {arrowValues.map((val) => (
                            <Button
                                key={val}
                                onClick={() => handleArrowClick(val)}
                                className={`py-4 text-lg font-semibold ${getScoreColor(val)} hover:opacity-80`}                         >
                                {val}
                            </Button>
                        ))}
                    </div>
                )
            )}
            {config.useTargetFace && (
                <p className="text-sm mb-2 text-muted-foreground">
                    Click the target face to register each arrow.
                </p>
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
                                const display = typeof val === "object" ? val.score : val;
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
                                                ? `${getScoreColor(typeof val === "object" ? val.score : val)} hover:opacity-75`
                                                : "bg-muted/30 cursor-default"
                                            }`}
                                    >
                                        {typeof val === "object" ? val.score : val}
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
                        .map((end, i): [EndData, number] => [end, i])
                        .reverse()
                        .map(([end, i]) => (
                            <div
                                key={i}
                                className="flex justify-between items-center border-b py-1 text-sm cursor-pointer hover:bg-muted/40 rounded-md px-2"
                                onClick={() => handleEditEnd(i)}
                            >
                                <span>
                                    End {i + 1}:{" "}
                                    {end.map((val, j) => {
                                        const score = typeof val === "object" ? val.score : val;
                                        return (
                                            <div
                                                key={j}
                                                className={`inline-flex w-10 h-10 items-center justify-center rounded-md border text-lg font-semibold mr-1 ${getScoreColor(score)}`}
                                            >
                                                {score}
                                            </div>
                                        );
                                    })}
                                </span>
                                <span className="font-semibold">
                                    Total:{" "}
                                    {
                                        end.reduce((a: number, v) => {
                                            const s = typeof v === "object" ? v.score : v;
                                            if (s === "X") return a + 10;
                                            if (typeof s === "number") return a + s;
                                            return a;
                                        }, 0)
                                    }
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

            {/* Hidden live target render for capturing */}
            <div
                id="active-target-preview"
                style={{
                    position: "absolute",
                    top: "-9999px",
                    left: "-9999px"
                }}
            >
                {config.isTripleSpot ? (
                    <div>
                        {[0, 1, 2].map(faceIndex => (
                            <svg key={faceIndex} viewBox="0 0 200 200" width="200" height="200">
                                {/* Rings */}
                                {[6, 7, 8, 9, 10, "X"].map((s, i) => {
                                    const score = s === "X" ? 10 : Number(s);
                                    return (
                                        <circle
                                            key={i}
                                            cx={100}
                                            cy={100}
                                            r={100 - i * (100 / 6)}
                                            fill={
                                                score >= 9 ? "#f5cc2d" :         // 10/9/X gold
                                                    score >= 7 ? "#df4b4b" :         // 8/7 red
                                                        "#5e84e0"                         // 6 blue
                                            }
                                            stroke="#000"
                                            strokeWidth="0.6"
                                        />
                                    );
                                })}

                                {/* Arrow Dots */}
                                {ends
                                    .flat()
                                    .filter((a): a is TargetFaceArrow => typeof a === "object" && a.faceIndex === faceIndex)
                                    .map((a, j) => (
                                        <circle
                                            key={`${a.xPct}-${a.yPct}-${a.faceIndex}-${j}`}
                                            cx={(a.xPct / 100) * 200}
                                            cy={(a.yPct / 100) * 200}
                                            r={5}
                                            fill="lime"
                                            stroke="black"
                                            strokeWidth="1.5"
                                        />
                                    ))}
                            </svg>
                        ))}
                    </div>
                ) : (
                    <svg viewBox="0 0 200 200" width="200" height="200">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "X"].map((s, i) => {
                            const score = s === "X" ? 10 : Number(s);
                            return (
                                <circle
                                    key={i}
                                    cx={100}
                                    cy={100}
                                    r={100 - i * (100 / 11)}
                                    fill={
                                        score >= 9 ? "#f5cc2d"
                                            : score >= 7 ? "#df4b4b"
                                                : score >= 5 ? "#5e84e0"
                                                    : score >= 3 ? "#1f1f1f"
                                                        : "#ffffff"
                                    }
                                    stroke="#000"
                                    strokeWidth="0.6"
                                />
                            );
                        })}

                        {/* Arrow Dots */}
                        {ends
                            .flat()
                            .filter(a => typeof a === "object")
                            .map((a, j) => (
                                <circle
                                    key={`${a.xPct}-${a.yPct}-${j}`}
                                    cx={(a.xPct / 100) * 200}
                                    cy={(a.yPct / 100) * 200}
                                    r={5}
                                    fill="lime"
                                    stroke="black"
                                    strokeWidth="1.5"
                                />
                            ))}
                    </svg>
                )}
            </div>

            {/* 🎯 Arrow Map Modal — actual target face preview */}
            {showArrowMap && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-neutral-900 border dark:border-neutral-700 rounded-lg shadow-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">

                        <h2 className="text-lg font-semibold mb-4 text-center">
                            Arrow Placement
                        </h2>

                        <div className="flex justify-center mb-4">
                            <div className="flex bg-muted rounded-lg p-1 space-x-1">
                                <button
                                    className="px-4 py-1 rounded-md text-sm font-medium bg-primary text-white"
                                >
                                    Map
                                </button>
                            </div>
                        </div>

                        {/* MAP CONTENT ONLY (NO HEATMAP) */}
                        <div className="flex justify-center">

                            {config.isTripleSpot ? (
                                <div className="space-y-4">
                                    {[0, 1, 2].map((faceIndex) => (
                                        <svg
                                            key={faceIndex}
                                            viewBox="0 0 200 200"
                                            width="200"
                                            height="200"
                                        >
                                            {Array.from({ length: 6 }).map((_, i) => {
                                                const raw = [6, 7, 8, 9, 10, "X"][i];
                                                const score = Number(raw === "X" ? 10 : raw);

                                                return (
                                                    <circle
                                                        key={i}
                                                        cx={100}
                                                        cy={100}
                                                        r={100 - i * (100 / 6)}
                                                        fill={
                                                            score >= 9
                                                                ? "#f5cc2d"
                                                                : score >= 7
                                                                    ? "#df4b4b"
                                                                    : "#5e84e0"
                                                        }
                                                        stroke="#000"
                                                        strokeWidth="0.6"
                                                    />
                                                );
                                            })}

                                            {/* Arrow dots */}
                                            {ends
                                                .flat()
                                                .filter(
                                                    (a): a is TargetFaceArrow =>
                                                        typeof a === "object" &&
                                                        a.faceIndex === faceIndex
                                                )
                                                .map((a, j) => (
                                                    <circle
                                                        key={`${a.xPct}-${a.yPct}-${a.faceIndex}-${j}`}
                                                        cx={(a.xPct / 100) * 200}
                                                        cy={(a.yPct / 100) * 200}
                                                        r={5}
                                                        fill="lime"
                                                        stroke="black"
                                                        strokeWidth="1.5"
                                                    />
                                                ))}
                                        </svg>
                                    ))}
                                </div>
                            ) : (
                                <svg viewBox="0 0 200 200" width="260" height="260">
                                    {/* WA SINGLE FACE */}
                                    {Array.from({ length: 11 }).map((_, i) => {
                                        const raw = [1,2,3,4,5,6,7,8,9,10,"X"][i];
                                        const score = Number(raw === "X" ? 10 : raw);

                                        return (
                                            <circle
                                                key={i}
                                                cx={100}
                                                cy={100}
                                                r={100 - i * (100 / 11)}
                                                fill={
                                                    score >= 9 ? "#f5cc2d" :
                                                        score >= 7 ? "#df4b4b" :
                                                            score >= 5 ? "#5e84e0" :
                                                                score >= 3 ? "#1f1f1f" :
                                                                    "#ffffff"
                                                }
                                                stroke="#000"
                                                strokeWidth="0.6"
                                            />
                                        );
                                    })}

                                    {/* Arrow dots */}
                                    {ends
                                        .flat()
                                        .filter((a) => typeof a === "object")
                                        .map((a, j) => (
                                            <circle
                                                key={`${a.xPct}-${a.yPct}-${j}`}
                                                cx={(a.xPct / 100) * 200}
                                                cy={(a.yPct / 100) * 200}
                                                r={5}
                                                fill="lime"
                                                stroke="black"
                                                strokeWidth="1.5"
                                            />
                                        ))}
                                </svg>
                            )}
                        </div>

                        <div className="flex justify-center mt-6">
                            <Button onClick={() => setShowArrowMap(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}