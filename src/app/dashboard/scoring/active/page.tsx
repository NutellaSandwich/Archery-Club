"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Delete, Target } from "lucide-react";
// 🟢 FIXED: Import TargetFaceArrow and TargetFaceInputRef from the component
import TargetFaceInput, { TargetFaceInputRef, TargetFaceArrow } from "@/components/TargetFaceInput";
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

// 🔴 REMOVED: Duplicate declaration (now imported from TargetFaceInput.tsx)
// type TargetFaceArrow = {
//     score: ArrowInput;
//     xPct: number; // 0–100 SVG position
//     yPct: number;
//     faceIndex: number; // 0–2 for triple spot
// };

// Update stopZoom signature to accept optional event
type PointerEvent = React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>;
type EventLike = PointerEvent | Event;

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

    // 🟢 NEW REF: Added to connect to TargetFaceInput
    const targetFaceRef = useRef<TargetFaceInputRef | null>(null);

    // ---- Magnifier State ----
    const [zoomActive, setZoomActive] = useState(false);
    const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
    const magnifierSize = 110; // px size of circle
    const zoomRef = useRef<HTMLDivElement | null>(null);
    const [targetSnapshot, setTargetSnapshot] = useState<HTMLCanvasElement | null>(
        null
    );

    // Long-press detection
    const isPointerDown = useRef(false);
    const holdTimeoutRef = useRef<number | null>(null);
    const lastPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Tracks if a successful hold/zoom occurred
    const didZoomOccur = useRef(false);

    const suppressNextClick = useRef(false);

    // 🔹 Load config from session
    useEffect(() => {
        const stored = sessionStorage.getItem("scoringConfig");
        if (!stored) {
            router.push("/dashboard/scoring");
            return;
        }
        setConfig(JSON.parse(stored));
    }, [router]);

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

    const isWorcester = config?.round?.name?.toLowerCase().includes("worcester");

    const arrowValues: ArrowInput[] = isWorcester
        ? config?.isTripleSpot
            ? [5, 4, 3, "M"]
            : [5, 4, 3, 2, 1, "M"]
        : config?.isTripleSpot
            ? ["X", 10, 9, 8, 7, 6, "M"]
            : ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "M"];

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
                    return "bg-[#74c96a] text-black";
                default:
                    return "bg-muted/30";
            }
        }

        if (val === "X" || val === 10 || val === 9)
            return "bg-[#f5cc2d] text-black";

        if (val === 8 || val === 7) return "bg-[#df4b4b] text-white";

        if (val === 6 || val === 5) return "bg-[#5e84e0] text-white";

        if (val === 4 || val === 3) return "bg-[#1f1f1f] text-white";

        if (val === 2 || val === 1) return "bg-white text-black border";

        if (val === "M") return "bg-[#74c96a] text-black";

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

        const totalEnds =
            config ? config.round.total_arrows / config.arrowsPerEnd : 0;

        if (updated.length >= totalEnds && !shownRoundCompleteToast.current) {
            shownRoundCompleteToast.current = true;
            setRoundComplete(true);
            toast.success("Round complete! Review your scores before submitting.");
        }
    };

    const handleUndo = () => {
        setCurrentArrows((prev) => prev.slice(0, -1));
    };

    const handleEditEnd = (index: number) => {
        setEditingEndIndex(index);
        setCurrentArrows([...ends[index]]);
        setCurrentEnd(index + 1);
    };

    const totalScore = ends.flat().reduce<number>((acc, v) => {
        const s = typeof v === "object" ? v.score : v;
        if (s === "X") return acc + 10;
        if (typeof s === "number") return acc + s;
        return acc;
    }, 0);

    const golds = isWorcester
        ? 0
        : ends
            .flat()
            .filter((v) => {
                const s = typeof v === "object" ? v.score : v;
                return s === 10 || s === "X";
            }).length;

    const totalArrowsShot = ends.flat().length;
    const avgArrow =
        totalArrowsShot > 0 ? (totalScore / totalArrowsShot).toFixed(2) : "0.00";

    // ✅ Auto-save full end
    useEffect(() => {
        const perEnd = config?.arrowsPerEnd || 3;
        if (
            currentArrows.length === perEnd &&
            editingEndIndex === null &&
            !roundComplete
        ) {
            const t = window.setTimeout(() => handleSaveEnd(), 250);
            return () => window.clearTimeout(t);
        }
    }, [currentArrows, editingEndIndex, config, roundComplete]);

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
            archerName: localStorage.getItem("profile_username"),
            clubName: localStorage.getItem("profile_clubname"),
            bowstyle: localStorage.getItem("profile_bowstyle"),
        };

        (async () => {
            const targetImage = await renderTargetImage();

            const finalPayload = {
                ...summaryData,
                targetImage,
                archerName: summaryData.archerName,
                clubName: summaryData.clubName,
                bowstyle: summaryData.bowstyle,
            };

            localStorage.setItem("lastScoreData", JSON.stringify(finalPayload));
            router.push("/dashboard/scoring/summary");
        })();
    };

    // 🔚 Global safety: if pointer ends outside the container
    useEffect(() => {
        const handleUp = () => {
            // No event needed for global stopZoom, just cancel state
            // The actual registration happens in the component's onMouseUp/onTouchEnd
            stopZoom();
        };

        window.addEventListener("mouseup", handleUp);
        window.addEventListener("touchend", handleUp);

        return () => {
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("touchend", handleUp);
        };
    });

    if (!config) {
        return (
            <main className="flex items-center justify-center min-h-screen text-muted-foreground">
                <p>Loading scoring setup...</p>
            </main>
        );
    }

    const totalEnds =
        config ? config.round.total_arrows / config.arrowsPerEnd : 0;

    const canInputNewEnd =
        !roundComplete && ends.length < totalEnds && editingEndIndex === null;

    // 🔍 Long-press to start zoom
    const startZoom = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;

        isPointerDown.current = true;

        const clientX =
            "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY =
            "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        lastPointerPos.current = { x: clientX, y: clientY };

        if (holdTimeoutRef.current !== null) {
            window.clearTimeout(holdTimeoutRef.current);
        }

        // 🟢 FIX 1: Reduce timeout to 50ms for near-instant response on hold
        holdTimeoutRef.current = window.setTimeout(() => {
            if (!isPointerDown.current) return;

            // Hold was successful, now activate zoom and track it
            didZoomOccur.current = true;
            setZoomActive(true);
            updateCrosshair(lastPointerPos.current.x, lastPointerPos.current.y); // Set initial visible position

            // Render snapshot (async)
            requestAnimationFrame(async () => {
                const container = document.getElementById("live-target-container");
                if (container) {
                    const canvas = await html2canvas(container, {
                        backgroundColor: null,
                        scale: 1.2, // slightly lower for speed
                        logging: false,
                    });
                    setTargetSnapshot(canvas);
                }
            });
        }, 50); // <-- CHANGED from 150 to 50
    };

    const moveZoom = (e: PointerEvent) => {
        if (!isPointerDown.current) return;

        const clientX =
            "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY =
            "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        lastPointerPos.current = { x: clientX, y: clientY };

        if (!zoomActive) return;

        updateCrosshair(clientX, clientY);
    };

    // 🟢 FIX 3: Use exposed method on TargetFaceInput ref
    const stopZoom = (e?: EventLike) => {
        // Only run the registration/suppression logic if a successful hold occurred.
        if (didZoomOccur.current) {
            // Set flag to suppress next standard click event
            suppressNextClick.current = true;

            let finalX = lastPointerPos.current.x;
            let finalY = lastPointerPos.current.y;

            // Use changedTouches for the final release position on mobile (most accurate)
            if (e && "changedTouches" in e && e.changedTouches.length > 0) {
                finalX = e.changedTouches[0].clientX;
                finalY = e.changedTouches[0].clientY;
            } else if (e && "clientX" in e) {
                // Mouse up case where the position is known from the event
                finalX = e.clientX;
                finalY = e.clientY;
            }

            // Store coordinates for the next tick
            const xToRegister = finalX;
            const yToRegister = finalY;

            // 1. Immediately clear state (will trigger re-render to hide magnifier)
            setZoomActive(false);
            setTargetSnapshot(null);

            // 2. Schedule registration for after re-render completes (0ms delay)
            window.setTimeout(() => {
                // Use the exposed method on the TargetFaceInput component's ref
                if (targetFaceRef.current) {
                    targetFaceRef.current.handlePrecisePlacement(xToRegister, yToRegister);
                }
                // Clear suppression flag after attempt to allow normal clicks again
                suppressNextClick.current = false;
            }, 0);
        }

        // Reset tracking flags regardless of zoom success
        isPointerDown.current = false;
        didZoomOccur.current = false;

        if (holdTimeoutRef.current !== null) {
            window.clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
        }
    };

    // update crosshair relative to zoom container
    const updateCrosshair = (x: number, y: number) => {
        if (!zoomRef.current) return;

        const rect = zoomRef.current.getBoundingClientRect();
        const relX = x - rect.left;
        const relY = y - rect.top;

        setZoomPos({
            x: relX,
            y: relY,
        });
    };

    // 🔴 REMOVED: No longer needed, logic is moved to TargetFaceInput.tsx
    // function registerArrowAtPoint(x: number, y: number) {
    //     const el = document.elementFromPoint(x, y);
    //     if (!el) return;

    //     // Find dataset attributes from the target component 
    //     const targetElement = el.closest('[data-score][data-x][data-y]');

    //     if (!targetElement) return;

    //     const score = targetElement.getAttribute("data-score");
    //     const xPct = targetElement.getAttribute("data-x");
    //     const yPct = targetElement.getAttribute("data-y");
    //     const face = targetElement.getAttribute("data-face");

    //     if (score && xPct && yPct) {
    //         handleArrowClick({
    //             score: score as ArrowInput,
    //             xPct: Number(xPct),
    //             yPct: Number(yPct),
    //             faceIndex: face ? Number(face) : 0
    //         });
    //     }
    // }

    return (
        <main className="w-full px-4 sm:px-6 md:max-w-3xl mx-auto space-y-8">
            <div
                className="
                    flex justify-between items-center p-4 rounded-xl border border-border/40 
                    relative bg-card/60
                    before:absolute before:inset-0 before:-z-10
                    before:bg-gradient-to-r before:from-emerald-600/10 via-sky-500/10 to-emerald-600/10
                    before:rounded-xl shadow-sm
                "
            >
                <h1 className="text-xl font-semibold relative">
                    {config.round.name}
                    <div
                        className="mt-1 h-[2px] w-32 mx-auto 
                            bg-gradient-to-r from-emerald-600/50 via-sky-500/50 to-emerald-600/50 
                            rounded-full"
                    />
                </h1>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArrowMap(true)}
                        className="p-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition flex items-center gap-2"
                        title="Show Arrow Placement Map"
                    >
                        <Target size={22} />
                        <span className="hidden sm:inline text-sm font-medium">
                            Arrow Map
                        </span>
                    </button>

                    <p className="text-sm text-muted-foreground">
                        End {currentEnd} of {totalEnds}
                    </p>
                </div>
            </div>

            <p className="text-xs text-gray-500 mb-1 text-center">Hold to zoom</p>

            <div
                className="w-full h-px my-4 
                    bg-gradient-to-r from-emerald-600/40 via-sky-500/40 to-emerald-600/40"
            />

            {(canInputNewEnd || editingEndIndex !== null) &&
                (config.useTargetFace ? (
                    <div
                        ref={zoomRef}
                        className="
                            relative w-full flex justify-center items-center touch-none select-none p-4 rounded-xl
                            border border-border/40 bg-card/40
                            before:absolute before:inset-0 before:-z-10
                            before:bg-gradient-to-r before:from-emerald-600/10 via-sky-500/10 to-emerald-600/10
                            before:rounded-xl
                        "
                        onMouseDown={startZoom}
                        onMouseMove={moveZoom}
                        onMouseUp={stopZoom}
                        onMouseLeave={() => stopZoom()} // No event needed for mouse leave
                        onTouchStart={startZoom}
                        onTouchMove={moveZoom}
                        onTouchEnd={stopZoom}
                    >
                        <div
                            id="live-target-container"
                            onClickCapture={(e) => {
                                // This handler stops the native click event if a hold/zoom occurred
                                // The flag is cleared inside stopZoom's setTimeout now, so this catches the immediate click.
                                if (suppressNextClick.current) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // We don't clear the flag here, stopZoom's setTimeout does it to ensure the registration call is complete.
                                }
                            }}
                        >
                            <TargetFaceInput
                                ref={targetFaceRef} // 🟢 ATTACHED REF
                                arrowsPerEnd={config.arrowsPerEnd}
                                isTripleSpot={!!config.isTripleSpot}
                                currentArrows={currentArrows as TargetFaceArrow[]}
                                onSelectArrow={(arrow) => handleArrowClick(arrow)}
                            />
                        </div>

                        {zoomActive && targetSnapshot && zoomRef.current && (
                            <div
                                className="pointer-events-none absolute rounded-full border border-gray-300 shadow-xl overflow-hidden bg-white"
                                style={{
                                    width: magnifierSize,
                                    height: magnifierSize,
                                    // Position magnifier relative to the pointer
                                    left: zoomPos.x,
                                    top: zoomPos.y,
                                    transform: "translate(-50%, -100%)", // Position circle center over finger, adjust up
                                }}
                            >
                                {(() => {
                                    const container =
                                        document.getElementById("live-target-container");
                                    const containerRect =
                                        container!.getBoundingClientRect();

                                    const scaleX =
                                        targetSnapshot.width / containerRect.width;
                                    const scaleY =
                                        targetSnapshot.height / containerRect.height;

                                    const targetLeft =
                                        (zoomRef.current!.clientWidth -
                                            containerRect.width) /
                                        2;
                                    const targetTop =
                                        (zoomRef.current!.clientHeight -
                                            containerRect.height) /
                                        2;

                                    const offsetX = zoomPos.x - targetLeft;
                                    const offsetY = zoomPos.y - targetTop;

                                    return (
                                        <div
                                            style={{
                                                position: "absolute",
                                                // Pan the image so the crosshair center aligns with the pointer position
                                                left:
                                                    -(offsetX * scaleX) +
                                                    magnifierSize / 2,
                                                top:
                                                    -(offsetY * scaleY) +
                                                    magnifierSize / 2,
                                                width: targetSnapshot.width,
                                                height: targetSnapshot.height,
                                                backgroundImage: `url(${targetSnapshot.toDataURL()})`,
                                                backgroundSize: `${targetSnapshot.width}px ${targetSnapshot.height}px`,
                                            }}
                                        />
                                    );
                                })()}

                                {/* Center crosshair */}
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="relative w-3 h-3 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white border border-black rounded-full"></div>
                                        <div className="absolute w-[1px] h-6 bg-black/70"></div>
                                        <div className="absolute h-[1px] w-6 bg-black/70"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
                ))}

            {config.useTargetFace && (
                <p className="text-sm mb-2 text-muted-foreground">
                    Click the target face to register each arrow.
                </p>
            )}

            {(canInputNewEnd || editingEndIndex !== null) && (
                <div className="border rounded-lg p-4 mt-4">
                    <h3
                        className="font-medium mb-4 relative pb-2
        after:block after:h-[2px] after:w-20 after:rounded-full
        after:bg-gradient-to-r from-emerald-600 via-sky-500 to-emerald-600"
                    >
                        {editingEndIndex !== null
                            ? `Editing End ${editingEndIndex + 1}`
                            : `Current End`}
                    </h3>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                            {Array.from({ length: config.arrowsPerEnd }).map((_, i) => {
                                const val = currentArrows[i];
                                const display =
                                    typeof val === "object" ? val.score : val;
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
                                            ? `${getScoreColor(
                                                typeof val === "object"
                                                    ? val.score
                                                    : val
                                            )} hover:opacity-75`
                                            : "bg-muted/30 cursor-default"
                                            }`}
                                    >
                                        {display}
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

            {ends.length > 0 && (
                <div className="w-full flex justify-center">
                    <div
                        className="
                            border rounded-xl p-4 space-y-3 w-[85vw] sm:w-full max-w-[600px] 
                            bg-card/50 relative
                            before:absolute before:inset-0 before:-z-10
                            before:bg-gradient-to-r before:from-emerald-600/10 via-sky-500/10 to-emerald-600/10
                            before:rounded-xl shadow-sm
                        "
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">Saved Ends</h3>
                            <span className="text-xs text-muted-foreground">
                                avg: {avgArrow}
                            </span>
                        </div>

                        {[...ends]
                            .map((end, i): [EndData, number] => [end, i])
                            .reverse()
                            .map(([end, i]) => (
                                <div
                                    key={i}
                                    className="
                                        flex items-center justify-between py-2 text-sm cursor-pointer 
                                        rounded-md px-2 w-full transition
                                        border-b border-border/30
                                        hover:bg-gradient-to-r hover:from-emerald-600/10 hover:via-sky-500/10 hover:to-emerald-600/10
                                    "
                                    onClick={() => handleEditEnd(i)}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="whitespace-nowrap font-medium">
                                            End {i + 1}:
                                        </span>

                                        <div className="flex gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                                            {end.map((val, j) => {
                                                const score =
                                                    typeof val === "object" ? val.score : val;
                                                return (
                                                    <div
                                                        key={j}
                                                        className={`flex-shrink-0 flex w-10 h-10 items-center justify-center rounded-md border text-lg font-semibold ${getScoreColor(
                                                            score
                                                        )}`}
                                                    >
                                                        {score}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <span className="font-semibold pl-4 whitespace-nowrap">
                                        Total:{" "}
                                        {end.reduce((a: number, v) => {
                                            const s =
                                                typeof v === "object" ? v.score : v;
                                            if (s === "X") return a + 10;
                                            if (typeof s === "number") return a + s;
                                            return a;
                                        }, 0)}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <div
                className="w-full h-px my-8 
                    bg-gradient-to-r from-emerald-600/40 via-sky-500/40 to-emerald-600/40"
            />

            {roundComplete && (
                <div className="text-center space-y-4">
                    <p className="text-lg font-semibold">
                        Round Complete! Total: {totalScore}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        You can still edit your ends before submitting.
                    </p>
                    <Button
                        onClick={handleSubmitRound}
                        className="
                            mt-2 px-8 rounded-xl shadow-md
                            bg-gradient-to-r from-emerald-600 to-sky-500 text-white
                            hover:opacity-90 transition
                        "
                    >
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
                    left: "-9999px",
                }}
            >
                {config.isTripleSpot ? (
                    <div>
                        {[0, 1, 2].map((faceIndex) => (
                            <svg
                                key={faceIndex}
                                viewBox="0 0 200 200"
                                width="200"
                                height="200"
                            >
                                {[6, 7, 8, 9, 10, "X"].map((s, i) => {
                                    const score = s === "X" ? 10 : Number(s);
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

                                {ends
                                    .flat()
                                    .filter(
                                        (
                                            a
                                        ): a is TargetFaceArrow =>
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
                                        score >= 9
                                            ? "#f5cc2d"
                                            : score >= 7
                                                ? "#df4b4b"
                                                : score >= 5
                                                    ? "#5e84e0"
                                                    : score >= 3
                                                        ? "#1f1f1f"
                                                        : "#ffffff"
                                    }
                                    stroke="#000"
                                    strokeWidth="0.6"
                                />
                            );
                        })}

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

            {/* 🎯 Arrow Map Modal */}
            {showArrowMap && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div
                        className="
                            bg-white dark:bg-neutral-900 rounded-xl shadow-xl p-6 
                            w-full max-w-xl max-h[90vh] overflow-y-auto border border-border/40
                            relative
                            before:absolute before:inset-0 before:-z-10
                            before:bg-gradient-to-r before:from-emerald-600/10 via-sky-500/10 to-emerald-600/10
                            before:rounded-xl
                        "
                    >
                        <h2 className="text-lg font-semibold mb-4 text-center">
                            Arrow Placement
                        </h2>

                        <div className="flex justify-center mb-4">
                            <div className="flex bg-muted rounded-lg p-1 space-x-1">
                                <button className="px-4 py-1 rounded-md text-sm font-medium bg-primary text-white">
                                    Map
                                </button>
                            </div>
                        </div>

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
                                                const score = Number(
                                                    raw === "X" ? 10 : raw
                                                );

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

                                            {ends
                                                .flat()
                                                .filter(
                                                    (
                                                        a
                                                    ): a is TargetFaceArrow =>
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
                                    {Array.from({ length: 11 }).map((_, i) => {
                                        const raw = [
                                            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "X",
                                        ][i];
                                        const score = Number(
                                            raw === "X" ? 10 : raw
                                        );

                                        return (
                                            <circle
                                                key={i}
                                                cx={100}
                                                cy={100}
                                                r={100 - i * (100 / 11)}
                                                fill={
                                                    score >= 9
                                                        ? "#f5cc2d"
                                                        : score >= 7
                                                            ? "#df4b4b"
                                                            : score >= 5
                                                                ? "#5e84e0"
                                                                : score >= 3
                                                                    ? "#1f1f1f"
                                                                    : "#ffffff"

                                                }
                                                stroke="#000"
                                                strokeWidth="0.6"
                                            />
                                        );
                                    })}

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
                            <Button onClick={() => setShowArrowMap(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}