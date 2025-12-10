"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"; // 🟢 ADDED forwardRef, useImperativeHandle

export type ArrowInput = number | "M" | "X";

export type TargetFaceArrow = {
    score: ArrowInput;
    xPct: number;
    yPct: number;
    faceIndex: number;
};

// 🟢 NEW: Define the exposed functions for the ref
export type TargetFaceInputRef = {
    handlePrecisePlacement: (x: number, y: number) => void;
    // Add other exposed methods here if needed later
};

type TargetFaceInputProps = {
    arrowsPerEnd: number;
    isTripleSpot?: boolean;
    onSelectArrow: (arrow: TargetFaceArrow) => void;
    currentArrows: TargetFaceArrow[];
};

// 🟢 MODIFIED: Wrap component with forwardRef
const TargetFaceInput = forwardRef<TargetFaceInputRef, TargetFaceInputProps>(
    ({ arrowsPerEnd, isTripleSpot = false, onSelectArrow, currentArrows }, ref) => {

        const scores: ArrowInput[] = ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        const tripleScores: ArrowInput[] = ["X", 10, 9, 8, 7, 6];

        const getColor = (score: ArrowInput) => {
            if (score === "M") return "#74c96a";
            if (score === "X" || score === 10 || score === 9) return "#f5cc2d";
            if (score === 8 || score === 7) return "#df4b4b";
            if (score === 6 || score === 5) return "#5e84e0";
            if (score === 4 || score === 3) return "#1f1f1f";
            if (score === 2 || score === 1) return "#ffffff";
            return "#cccccc";
        };

        // UI state
        const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
        const [activeFace, setActiveFace] = useState(0);
        const [snapEnabled, setSnapEnabled] = useState(true);
        const [isAnimating, setIsAnimating] = useState(false);

        const scrollRef = useRef<HTMLDivElement | null>(null);
        const queuedScroll = useRef<number | null>(null);
        const prevCount = useRef(0);

        // Vibration / shake fallback
        const vibrate = () => {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(12);
            }
        };

        // Smooth scroll with queued scroll
        const goToFace = (index: number, duration = 650) => {
            if (!scrollRef.current) return;

            const container = scrollRef.current;
            const clamped = Math.max(0, Math.min(2, index));

            const targetTop = clamped * container.clientHeight;
            const startTop = container.scrollTop;
            const distance = targetTop - startTop;

            let startTime: number | null = null;
            const easing = (t: number) => 1 - Math.pow(1 - t, 3);

            setIsAnimating(true);
            setSnapEnabled(false);

            const animate = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);

                container.scrollTop = startTop + distance * easing(progress);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setTimeout(() => {
                        setIsAnimating(false);
                        setSnapEnabled(true);

                        if (queuedScroll.current !== null) {
                            const next = queuedScroll.current;
                            queuedScroll.current = null;
                            setTimeout(() => goToFace(next, 650), 60);
                        }
                    }, 40);
                }
            };

            requestAnimationFrame(animate);
            setActiveFace(clamped);
            vibrate();
        };

        // Detect new end
        useEffect(() => {
            if (!isTripleSpot) return;

            const isNewEnd = currentArrows.length === 0 && prevCount.current > 0;

            if (isNewEnd) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setTimeout(() => goToFace(0, 700), 60);
                    });
                });
            }

            prevCount.current = currentArrows.length;
        }, [currentArrows, arrowsPerEnd, isTripleSpot]);

        // Auto-scroll after selecting arrow
        useEffect(() => {
            if (!isTripleSpot || !shouldAutoScroll) return;

            const next = Math.min(2, activeFace + 1);

            if (isAnimating) {
                queuedScroll.current = next;
                setShouldAutoScroll(false);
                return;
            }

            setTimeout(() => {
                goToFace(next, 650);
                setShouldAutoScroll(false);
            }, 180);
        }, [shouldAutoScroll, activeFace, isTripleSpot, isAnimating]);

        // 🟢 NEW: Unified scoring logic for both click and precise placement
        const calculateAndSelectArrow = (
            targetX: number, // Client X coordinate
            targetY: number, // Client Y coordinate
            faceIndex: number // Current face index (0 for single, 0-2 for triple)
        ) => {
            // Find the specific SVG element corresponding to the target face
            const svgElement = document.getElementById(`target-face-${faceIndex}`);
            if (!svgElement) return;

            const rect = svgElement.getBoundingClientRect();

            // Calculate click position relative to the SVG element
            const x = targetX - rect.left;
            const y = targetY - rect.top;

            // Normalize position to the 200x200 viewBox
            const cx = (x / rect.width) * 200;
            const cy = (y / rect.height) * 200;

            const dx = cx - 100;
            const dy = cy - 100;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const activeScores = isTripleSpot ? tripleScores : scores;
            const ringCount = activeScores.length;
            const ringWidth = 100 / ringCount;
            const ringIndex = Math.floor(dist / ringWidth);

            const score = ringIndex >= ringCount
                ? "M"
                : activeScores[ringIndex];

            onSelectArrow({
                score,
                xPct: (cx / 200) * 100, // 0-100 percentage for display
                yPct: (cy / 200) * 100,
                faceIndex,
            });

            vibrate();
            setShouldAutoScroll(true);
        };

        // 🔴 MODIFIED: Rerouted onClickFace to use the new unified scoring function
        const onClickFace = (
            e: React.MouseEvent<SVGElement, MouseEvent>,
            faceIndex: number
        ) => {
            if (isTripleSpot && currentArrows.some((a) => a.faceIndex === faceIndex))
                return;

            calculateAndSelectArrow(e.clientX, e.clientY, faceIndex);
        };

        // 🟢 NEW: Expose method to parent via ref for precise placement (from zoom)
        useImperativeHandle(ref, () => ({
            handlePrecisePlacement: (x: number, y: number) => {
                // This is called from the parent component (ActiveScoringPage) after the magnifier releases
                calculateAndSelectArrow(x, y, activeFace);
            },
        }));

        return (
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2">

                {/* SINGLE SPOT */}
                {!isTripleSpot && (
                    <svg
                        id="target-face-0" // 🟢 ADDED ID for precise lookup
                        viewBox="0 0 200 200"
                        className="w-full h-auto cursor-crosshair"
                        onClick={(e) => onClickFace(e, 0)}
                    >
                        {[...scores].reverse().map((score, i) => (
                            <circle
                                key={score + "-" + i}
                                cx={100}
                                cy={100}
                                r={100 - i * (100 / scores.length)}
                                fill={getColor(score)}
                                stroke={score === 3 || score === 4 ? "#fff" : "#000"}
                                strokeWidth={score === 3 || score === 4 ? 0.8 : 0.5}
                            />
                        ))}

                        {/* CROSSHAIRS */}
                        <line x1={98} y1={100} x2={102} y2={100} stroke="#000" strokeWidth="0.6" />
                        <line x1={100} y1={98} x2={100} y2={102} stroke="#000" strokeWidth="0.6" />

                        {/* markers */}
                        {currentArrows.map((arrow, i) => (
                            <circle
                                key={"mk" + i}
                                cx={(arrow.xPct / 100) * 200}
                                cy={(arrow.yPct / 100) * 200}
                                r={4}
                                className="fill-lime-500 stroke-black dark:stroke-white"
                                strokeWidth={1.5}
                            />
                        ))}
                    </svg>
                )}

                {/* TRIPLE SPOT */}
                {isTripleSpot && (
                    <>
                        <div className="relative w-full flex justify-center">

                            {/* Progress dots */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={"dot-" + i}
                                        onClick={() => goToFace(i)}
                                        className={`
                                        rounded-full cursor-pointer transition-all
                                        ${i === activeFace ? "w-4 h-4 opacity-100" : "w-3 h-3 opacity-40"}
                                    `}
                                        style={{ background: "white" }}
                                    />
                                ))}
                            </div>

                            {/* Scroll container */}
                            <div
                                ref={scrollRef}
                                style={{
                                    overflowY: "auto",
                                    scrollSnapType: snapEnabled ? "y mandatory" : "none",
                                    width: "100%",
                                    height: "260px",
                                    scrollbarWidth: "none",
                                    msOverflowStyle: "none",
                                }}
                                onScroll={(e) => {
                                    if (isAnimating) return;
                                    const index = Math.round(
                                        e.currentTarget.scrollTop /
                                        e.currentTarget.clientHeight
                                    );
                                    setActiveFace(index);
                                }}
                            >
                                {[0, 1, 2].map((faceIndex) => (
                                    <div
                                        key={"face-" + faceIndex}
                                        style={{
                                            width: "100%",
                                            height: "260px",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                        }}
                                    >
                                        <svg
                                            id={`target-face-${faceIndex}`} // 🟢 ADDED ID for precise lookup
                                            viewBox="0 0 200 200"
                                            className="cursor-crosshair"
                                            style={{
                                                width: "min(100%, 260px)",
                                                height: "min(100%, 260px)",
                                                aspectRatio: "1 / 1",
                                            }}
                                            onClick={(e) => onClickFace(e, faceIndex)}
                                        >
                                            {[...tripleScores].reverse().map((score, i) => (
                                                <circle
                                                    key={score + "-" + i}
                                                    cx={100}
                                                    cy={100}
                                                    r={100 - i * (100 / tripleScores.length)}
                                                    fill={getColor(score)}
                                                    stroke="#000"
                                                    strokeWidth="0.5"
                                                />
                                            ))}

                                            {/* CROSSHAIRS */}
                                            <line
                                                x1={98}
                                                y1={100}
                                                x2={102}
                                                y2={100}
                                                stroke="#000"
                                                strokeWidth="0.6"
                                            />
                                            <line
                                                x1={100}
                                                y1={98}
                                                x2={100}
                                                y2={102}
                                                stroke="#000"
                                                strokeWidth="0.6"
                                            />

                                            {/* markers */}
                                            {currentArrows
                                                .filter((a) => a.faceIndex === faceIndex)
                                                .map((a, i) => (
                                                    <circle
                                                        key={"mk-" + faceIndex + "-" + i}
                                                        cx={(a.xPct / 100) * 200}
                                                        cy={(a.yPct / 100) * 200}
                                                        r={4}
                                                        className="fill-lime-500 stroke-black dark:stroke-white"
                                                        strokeWidth={1.5}
                                                    />
                                                ))}
                                        </svg>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Centered MISS button */}
                        <div className="w-full flex justify-center mt-3">
                            <button
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                                onClick={() => {
                                    onSelectArrow({
                                        score: "M",
                                        xPct: 0,
                                        yPct: 0,
                                        faceIndex: activeFace,
                                    });
                                    vibrate();
                                    setShouldAutoScroll(true);
                                }}
                            >
                                Miss (M)
                            </button>
                        </div>
                    </>
                )}

                {/* Single-spot MISS */}
                {!isTripleSpot && (
                    <button
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                        onClick={() => {
                            onSelectArrow({
                                score: "M",
                                xPct: 0,
                                yPct: 0,
                                faceIndex: 0,
                            });
                            vibrate();
                        }}
                    >
                        Miss (M)
                    </button>
                )}
            </div>
        );
    });

// Export the component with its display name
TargetFaceInput.displayName = "TargetFaceInput";
export default TargetFaceInput;