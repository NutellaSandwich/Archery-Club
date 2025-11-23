"use client";

import { motion } from "framer-motion";

export type ArrowInput = number | "M" | "X";

export type TargetFaceArrow = {
    score: ArrowInput;
    xPct: number;      // % of SVG width (0–100)
    yPct: number;      // % of SVG height (0–100)
    faceIndex: number; // 0, 1, 2 for triple; 0 always for single
};

type TargetFaceInputProps = {
    arrowsPerEnd: number;
    isTripleSpot?: boolean;
    onSelectArrow: (arrow: TargetFaceArrow) => void;
    currentArrows: TargetFaceArrow[];
};

export default function TargetFaceInput({
    arrowsPerEnd,
    isTripleSpot = false,
    onSelectArrow,
    currentArrows,
}: TargetFaceInputProps) {
    const scores: ArrowInput[] = ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const tripleScores: ArrowInput[] = ["X", 10, 9, 8, 7, 6];

    const getColor = (score: ArrowInput) => {
        if (score === "M") return "#74c96a"; // slightly brighter miss green

        // Yellow (X, 10, 9) — deeper gold
        if (score === "X" || score === 10 || score === 9) return "#f5cc2d";

        // Red (8, 7) — more vivid but still soft
        if (score === 8 || score === 7) return "#df4b4b";

        // Blue (6, 5) — brighter mid-blue
        if (score === 6 || score === 5) return "#5e84e0";

        // Black (4, 3) — true dark grey so white ring separation still shows
        if (score === 4 || score === 3) return "#1f1f1f";

        // White (2, 1) — clean white
        if (score === 2 || score === 1) return "#ffffff";

        return "#cccccc";
    };

    const faceHeight = isTripleSpot ? 200 / 3 : 200; // each face gets ⅓ of height if triple

    const onClickFace = (
        e: React.MouseEvent<SVGElement, MouseEvent>,
        faceIndex: number
    ) => {
        const svg = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - svg.left;
        const y = e.clientY - svg.top;

        const cx = (x / svg.width) * 200;
        const cy = (y / svg.height) * 200;

        // adjust y into the correct face
        const localY = cy - faceIndex * faceHeight;

        const dx = cx - 100;
        const dy = localY - faceHeight / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const maxRadius = faceHeight / 2;
        const ringWidth = maxRadius / scores.length;
        const ringIndex = Math.floor(dist / ringWidth);

        const score = ringIndex >= scores.length ? ("M" as ArrowInput) : scores[ringIndex];

        onSelectArrow({
            score,
            xPct: (cx / 200) * 100,
            yPct: (cy / 200) * 100,
            faceIndex,
        });
    };

    return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-4">
            <svg
                viewBox="0 0 200 200"
                className="w-full h-auto cursor-crosshair"
                onClick={(e) => {
                    if (!isTripleSpot) onClickFace(e, 0);
                }}
            >
                {!isTripleSpot && (
                    <>
                        {[...scores].reverse().map((score, i) => {
                            const radius = (faceHeight / 2) - i * ((faceHeight / 2) / scores.length);
                            return (
                                <circle
                                    key={`single-${score}`}
                                    cx={100}
                                    cy={faceHeight / 2}
                                    r={radius}
                                    fill={getColor(score)}
                                    stroke={score === 3 || score === 4 ? "#ffffff" : "#000"}
                                    strokeWidth={score === 3 || score === 4 ? 0.8 : 0.5}
                                />
                            );
                        })}
                    </>
                )}

                {isTripleSpot &&
                    [0, 1, 2].map((faceIndex) => {
                        const cy = faceIndex * faceHeight + faceHeight / 2;

                        return (
                            <g key={faceIndex} onClick={(e) => onClickFace(e, faceIndex)}>
                                {[...tripleScores].reverse().map((score, i) => {
                                    const radius =
                                        (faceHeight / 2) - i * ((faceHeight / 2) / tripleScores.length);

                                    return (
                                        <circle
                                            key={`triple-${faceIndex}-${score}`}
                                            cx={100}
                                            cy={cy}
                                            r={radius}
                                            fill={getColor(score)}
                                            stroke="#000"
                                            strokeWidth="0.5"
                                        />
                                    );
                                })}
                            </g>
                        );
                    })}

                {/* Add central "+" crosshair */}
                {/* Add central "+" crosshair */}
                {!isTripleSpot && (
                    <>
                        {/* horizontal line — 4px wide, thin stroke */}
                        <line
                            x1={98}
                            y1={faceHeight / 2}
                            x2={102}
                            y2={faceHeight / 2}
                            stroke="#000"
                            strokeWidth="0.6"
                        />
                        {/* vertical line — 4px tall, thin stroke */}
                        <line
                            x1={100}
                            y1={faceHeight / 2 - 2}
                            x2={100}
                            y2={faceHeight / 2 + 2}
                            stroke="#000"
                            strokeWidth="0.6"
                        />
                    </>
                )}

                {isTripleSpot &&
                    [0, 1, 2].map((faceIndex) => {
                        const cy = faceIndex * faceHeight + faceHeight / 2;

                        return (
                            <g key={`cross-${faceIndex}`}>
                                <line
                                    x1={98}
                                    y1={cy}
                                    x2={102}
                                    y2={cy}
                                    stroke="#000"
                                    strokeWidth="0.6"
                                />
                                <line
                                    x1={100}
                                    y1={cy - 2}
                                    x2={100}
                                    y2={cy + 2}
                                    stroke="#000"
                                    strokeWidth="0.6"
                                />
                            </g>
                        );
                    })}

                {currentArrows.map((arrow, i) => (
                    <circle
                        key={`marker-${i}`}
                        cx={(arrow.xPct / 100) * 200}
                        cy={(arrow.yPct / 100) * 200}
                        r={4}
                        fill="#00FF00"
                        stroke="#000"
                        strokeWidth="1"
                    />
                ))}
            </svg>

            <button
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                onClick={() =>
                    onSelectArrow({
                        score: "M",
                        xPct: 0,
                        yPct: 0,
                        faceIndex: 0,
                    })
                }
            >
                Miss (M)
            </button>
        </div>
    );
}