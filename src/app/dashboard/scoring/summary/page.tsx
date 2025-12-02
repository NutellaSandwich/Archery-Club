"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import SignaturePad from "react-signature-canvas";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";

type ArrowObj = {
    score: string | number;
    xPct: number;
    yPct: number;
    faceIndex: number;
};

type ScoreData = {
    roundName: string;
    total: number;
    golds: number;
    hits: number;
    isTripleSpot: boolean;
    arrowsPerEnd: number;
    ends: (string | number | ArrowObj)[][];
    targetImage?: string | null;
    archerName?: string;
    clubName?: string;
    bowstyle?: string;
};

type ProfileInfo = {
    username: string | null;
    bow_type: string | null;
    club_name: string | null;
};

function OptimizedSignaturePad({
    label,
    innerRef,
    isDark,
}: {
    label: string;
    innerRef: React.RefObject<SignaturePad | null>;
    isDark: boolean;
}) {
    useEffect(() => {
        if (!innerRef.current) return;
        const pad = innerRef.current;
        const canvas = pad.getCanvas();
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.strokeStyle = isDark ? "white" : "black";
    }, [isDark, innerRef]);

    return (
        <div>
            <p
                className={`text-sm mb-1 font-medium ${isDark ? "text-gray-100" : "text-gray-800"
                    }`}
            >
                {label} Signature:
            </p>
            <SignaturePad
                ref={innerRef}
                penColor={isDark ? "white" : "black"}
                backgroundColor="transparent"
                canvasProps={{
                    className: `border rounded-md w-full h-40 bg-transparent ${isDark ? "border-neutral-700" : "border-gray-300"
                        }`,
                }}
            />
        </div>
    );
}

function ArrowCell({ value }: { value: string | number }) {
    return (
        <td className="border border-black text-center align-middle text-xs py-1">
            {String(value)}
        </td>
    );
}

function InfoCell({
    children,
    bold = false,
}: {
    children: React.ReactNode;
    bold?: boolean;
}) {
    return (
        <td
            className={`border border-black text-center align-middle text-xs py-1 ${bold ? "font-semibold" : ""
                }`}
        >
            {children}
        </td>
    );
}

export default function ScoringSummaryPage() {
    const router = useRouter();
    const supabase = supabaseBrowser();

    const [scoreData, setScoreData] = useState<ScoreData | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [competitionName, setCompetitionName] = useState("");
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [pendingFormality, setPendingFormality] = useState<
        "formal" | "competition" | null
    >(null);
    const [isDark, setIsDark] = useState(false);
    const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

    const sigArcherRef = useRef<SignaturePad | null>(null);
    const sigCounterRef = useRef<SignaturePad | null>(null);
    const sheetContainerRef = useRef<HTMLDivElement | null>(null);
    const [sheetHeight, setSheetHeight] = useState(0);
    const [buttonScale, setButtonScale] = useState(1);

    useEffect(() => {
        function updateButtonScale() {
            const vw = window.innerWidth - 32; // safe viewport
            const baseWidth = 400;             // button block full width

            // Default: normal size
            let scale = 1;

            // If viewport too small, shrink proportionally
            if (vw < baseWidth) {
                scale = vw / baseWidth;
            }

            // Never go below 0.85 (readability floor)
            scale = Math.max(scale, 0.85);

            setButtonScale(scale);
        }

        updateButtonScale();
        window.addEventListener("resize", updateButtonScale);
        return () => window.removeEventListener("resize", updateButtonScale);
    }, []);

    // 🌗 Track color scheme
    useEffect(() => {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const update = () => setIsDark(mql.matches);
        update();
        mql.addEventListener("change", update);
        return () => mql.removeEventListener("change", update);
    }, []);

    // 👤 Load profile for Name / Club / Bowstyle
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("username, bow_type, club_id")
                    .eq("id", user.id)
                    .single();

                if (error || !profile) {
                    console.error("Profile load error:", error);
                    return;
                }

                let clubName: string | null = null;
                if (profile.club_id) {
                    const { data: club, error: clubError } = await supabase
                        .from("clubs")
                        .select("name")
                        .eq("id", profile.club_id)
                        .single();
                    if (!clubError && club) {
                        clubName = club.name;
                    }
                }

                setProfileInfo({
                    username: profile.username ?? null,
                    bow_type: profile.bow_type ?? null,
                    club_name: clubName,
                });

                setTimeout(() => {
                    setProfileInfo((p) => p);
                }, 50);
            } catch (e) {
                console.error("Profile load failed:", e);
            }
        };

        loadProfile();
    }, [supabase]);

    // 🔁 Load score data from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("lastScoreData");
        if (!stored) return;

        const parsed = JSON.parse(stored);
        const hits = parsed.ends
            ?.flat()
            ?.filter((v: string | number) => v !== "M").length;

        setScoreData({
            ...parsed,
            hits,
            targetImage: parsed.targetImage ?? null,
        });
    }, []);

    // Normalise ends so everything is ArrowObj
    useEffect(() => {
        if (!scoreData) return;

        if (
            scoreData.ends?.length &&
            typeof scoreData.ends[0][0] === "object" &&
            scoreData.ends[0][0] !== null &&
            "xPct" in scoreData.ends[0][0]
        ) {
            return;
        }

        const normalisedEnds = scoreData.ends.map((end) =>
            end.map((a: any) =>
                typeof a === "object"
                    ? a
                    : {
                        score: a,
                        xPct: 100,
                        yPct: 100,
                        faceIndex: 0,
                    }
            )
        );

        setScoreData((prev: ScoreData | null) =>
            prev ? { ...prev, ends: normalisedEnds } : prev
        );
    }, [scoreData]);

    const displayName = profileInfo?.username ?? scoreData?.archerName ?? "";
    const displayClub = profileInfo?.club_name ?? scoreData?.clubName ?? "";
    const displayBow = profileInfo?.bow_type ?? scoreData?.bowstyle ?? "";

    // Inside the second useEffect:
    useEffect(() => {
        // Add the computed display names as dependencies
        if (!scoreData || !profileInfo) return;
        let cancelled = false;

        const capture = async () => {
            const sheetWrapper = document.getElementById("sheetWrapper");
            const scaledContainer = sheetWrapper?.parentElement;
            if (!sheetWrapper || !scaledContainer) return;

            // 1. Wait for DOM to fully update with profile fields (Corrected TS usage)
            // This is a safety wait, but the new dependencies are the key fix.
            // Initial wait: resolve is correctly wrapped inside an arrow function.
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => { // Outer rAF callback
                    requestAnimationFrame(() => setTimeout(() => resolve(), 50)); // Inner rAF callback wraps setTimeout which calls resolve
                });
            });

            // --- SCALING FIX START --- (Already corrected in previous steps)

            // Save current scaling state
            const originalContainerTransform = scaledContainer.style.transform;
            const originalRootScale = document.documentElement.style.getPropertyValue("--sheet-scale");

            // Temporarily remove all scaling properties and set the container's height to its full, unscaled height
            scaledContainer.style.transform = "scale(1)";
            document.documentElement.style.setProperty("--sheet-scale", "1");

            // Ensure the container's height is correct for the unscaled content.
            const unscaledHeight = sheetWrapper.scrollHeight;
            scaledContainer.style.height = `${unscaledHeight}px`;


            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });

            const sheetCanvas = await html2canvas(sheetWrapper, {
                backgroundColor: "#ffffff",
                scale: window.devicePixelRatio,
                useCORS: true,
            });

            // Restore original scaling state immediately
            scaledContainer.style.transform = originalContainerTransform;
            // Restore original calculated height logic
            scaledContainer.style.height = `calc( (1200px * 1.45) * var(--sheet-scale) )`;
            document.documentElement.style.setProperty("--sheet-scale", originalRootScale);

            // --- SCALING FIX END ---

            if (!cancelled) {
                setImageUrl(sheetCanvas.toDataURL("image/png"));
            }
        };

        capture();
        return () => {
            cancelled = true;
        };
    }, [
        scoreData,
        profileInfo,
        // ADDED: These are the computed values rendered on the scoresheet
        displayName,
        displayClub,
        displayBow
    ]);

    useEffect(() => {
        function updateScale() {
            const sheetWidth = 1200; // your fixed sheet width
            const padding = 32; // small margin so it doesn't touch edges
            const available = window.innerWidth - padding;
            const scale = Math.min(1, available / sheetWidth);

            document.documentElement.style.setProperty("--sheet-scale", String(scale));
        }

        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);





    const handleFormalOrCompetition = (formality: "formal" | "competition") => {
        setPendingFormality(formality);
        setShowSignatureModal(true);
    };

    const handleSaveSignatures = async () => {
        try {
            if (!sigArcherRef.current || !sigCounterRef.current) {
                toast.error("Signatures not ready.");
                return;
            }
            if (sigArcherRef.current.isEmpty() || sigCounterRef.current.isEmpty()) {
                toast.error("Both signatures are required.");
                return;
            }

            if (!imageUrl) {
                toast.error("No scoresheet image available.");
                return;
            }

            // Always use BLACK signature ink for saving
            const archerSig = sigArcherRef.current.getTrimmedCanvas();
            const counterSig = sigCounterRef.current.getTrimmedCanvas();

            const img = new Image();
            img.src = imageUrl;
            await new Promise((r) => (img.onload = r));

            // Do NOT extend the canvas — signatures go ON TOP of the sheet
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw original sheet
            ctx.drawImage(img, 0, 0);

            // Force signature color to BLACK regardless of dark mode
            const convertToBlackSignature = (sig: HTMLCanvasElement) => {
                const sigCanvas = document.createElement("canvas");
                sigCanvas.width = sig.width;
                sigCanvas.height = sig.height;
                const sctx = sigCanvas.getContext("2d")!;
                sctx.drawImage(sig, 0, 0);

                const imgData = sctx.getImageData(0, 0, sig.width, sig.height);
                for (let i = 0; i < imgData.data.length; i += 4) {
                    const alpha = imgData.data[i + 3];
                    if (alpha > 20) {
                        imgData.data[i] = 0; // R
                        imgData.data[i + 1] = 0; // G
                        imgData.data[i + 2] = 0; // B
                    }
                }
                sctx.putImageData(imgData, 0, 0);

                return sigCanvas;
            };

            const blackArcher = convertToBlackSignature(archerSig);
            const blackCounter = convertToBlackSignature(counterSig);

            // Use ratios so it works regardless of html2canvas scaling
            const SIG_WIDTH_RATIO = 0.16;
            const SIG_HEIGHT_RATIO = 0.065;
            const ARCHER_X_RATIO = 0.25;
            const COUNTER_X_RATIO = 0.7;
            const BOTTOM_MARGIN = 50;
            const sigWidth = img.width * SIG_WIDTH_RATIO;
            const sigHeight = img.height * SIG_HEIGHT_RATIO;

            const archerX = img.width * ARCHER_X_RATIO;
            const counterX = img.width * COUNTER_X_RATIO;
            const sigY = img.height - BOTTOM_MARGIN - sigHeight;
            

            ctx.drawImage(blackArcher, archerX, sigY, sigWidth, sigHeight);
            ctx.drawImage(blackCounter, counterX, sigY, sigWidth, sigHeight);

            const finalSignedDataUrl = canvas.toDataURL("image/png");

            setImageUrl(finalSignedDataUrl);
            setShowSignatureModal(false);

            if (pendingFormality) {
                await handleUploadToFeed(pendingFormality, finalSignedDataUrl);
                setPendingFormality(null);
            }
        } catch (err) {
            console.error("❌ handleSaveSignatures failed:", err);
            toast.error("Something went wrong while saving signatures.");
        }
    };

    // ☁️ Upload to feed
    async function handleUploadToFeed(
        formality: "formal" | "informal" | "competition",
        signedImageUrl?: string
    ) {
        const finalImage = signedImageUrl || imageUrl;

        if (!scoreData || !finalImage) {
            toast.error("No scoresheet image available.");
            return;
        }
        setUploading(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                toast.error("You must be logged in to upload.");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("category, experience, bow_type, club_id")
                .eq("id", user.id)
                .single();

            if (profileError || !profile) {
                toast.error("Failed to load your profile data.");
                console.error(profileError);
                return;
            }

            const normalizeCategory = (v?: string | null) =>
                ["women", "female", "woman"].includes(v?.trim()?.toLowerCase() ?? "")
                    ? "women"
                    : "open";
            const normalizeExperience = (v?: string | null) =>
                ["novice", "beginner"].includes(v?.trim()?.toLowerCase() ?? "")
                    ? "novice"
                    : "experienced";

            const blob = await (await fetch(finalImage)).blob();
            const fileName = `${user.id}-${Date.now()}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("scoresheets")
                .upload(fileName, blob, { contentType: "image/png", upsert: false });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = await supabase.storage
                .from("scoresheets")
                .getPublicUrl(uploadData.path);

            const postPayload = {
                user_id: user.id,
                club_id: profile.club_id ?? null,
                round_name: scoreData.roundName,
                bow_type: profile.bow_type || "recurve",
                category: normalizeCategory(profile.category),
                experience: normalizeExperience(profile.experience),
                spot_type: scoreData.isTripleSpot ? "triple" : "full size",
                score: scoreData.total,
                golds: scoreData.golds,
                hits: scoreData.hits,
                score_type:
                    formality === "formal"
                        ? "Formal Practice"
                        : formality === "competition"
                            ? "Competition"
                            : "Informal Practice",
                scoresheet_url: publicUrlData.publicUrl,
                competition_name:
                    formality === "competition" ? competitionName || null : null,
                score_date: new Date().toISOString().split("T")[0],
                is_formal: formality === "formal",
                is_personal_best: false,
                is_club_record: false,
            };

            const { error } = await supabase.from("club_posts").insert(postPayload);
            if (error) throw error;

            router.push("/dashboard");
        } catch (err) {
            console.error("❌ Upload failed:", err);
            toast.error("Failed to upload score.");
        } finally {
            setUploading(false);
        }
    }

    if (!scoreData)
        return (
            <p className="text-center mt-10 text-muted-foreground">
                No score data found.
            </p>
        );

    const usedTargetScoring = scoreData.ends?.some((end) =>
        end.some(
            (a: any) =>
                typeof a === "object" &&
                a !== null &&
                a.xPct !== 100 &&
                a.yPct !== 100
        )
    );

    const todayStr = new Date().toLocaleDateString();

    // ------- PORTSMOUTH-STYLE ROW COMPUTATION (12 arrows per row) -------
    type PortsmouthRow = {
        j: number;
        arrowValues: (string | number)[];
        hd1: number;
        hd2: number;
        score: number;
        hits: number;
        golds: number;
        runningTotal: number;
    };

    // Flatten all arrow scores
    const flatArrows: (string | number)[] = [];
    scoreData.ends.forEach((end) => {
        end.forEach((arrow: any) => {
            const raw = typeof arrow === "object" ? arrow.score : arrow;
            flatArrows.push(raw);
        });
    });

    const rows: PortsmouthRow[] = [];
    let globalRunning = 0;
    let totalScore = 0;
    let totalHits = 0;
    let totalGolds = 0;

    const numRows = Math.ceil(flatArrows.length / 12);

    for (let i = 0; i < numRows; i++) {
        const slice = flatArrows.slice(i * 12, i * 12 + 12);
        while (slice.length < 12) slice.push("");

        let hd1 = 0;
        let hd2 = 0;
        let rowScore = 0;
        let rowHits = 0;
        let rowGolds = 0;

        slice.forEach((val, idx) => {
            const vStr = String(val).toUpperCase();
            if (vStr !== "M" && vStr !== "") rowHits += 1;
            if (vStr === "X" || vStr === "10") rowGolds += 1;

            let numeric = 0;
            if (vStr === "X") numeric = 10;
            else if (vStr === "M" || vStr === "") numeric = 0;
            else {
                const n = Number(vStr);
                if (!Number.isNaN(n)) numeric = n;
            }

            rowScore += numeric;
            if (idx < 6) hd1 += numeric;
            else hd2 += numeric;
        });

        globalRunning += rowScore;
        totalScore += rowScore;
        totalHits += rowHits;
        totalGolds += rowGolds;

        rows.push({
            j: i + 1,
            arrowValues: slice,
            hd1,
            hd2,
            score: rowScore,
            hits: rowHits,
            golds: rowGolds,
            runningTotal: globalRunning,
        });
    }

    const totals = {
        score: totalScore,
        hits: totalHits,
        golds: totalGolds,
    };



    return (
        <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            {/* 📋 Portsmouth-style scoresheet + optional target (captured together) */}
            <Card className="bg-transparent shadow-none border-none">
                <div className="w-full flex flex-col items-center">
                    {/* 🌟 NEW SCALE WRAPPER — collapses to scaled height */}
                    
                    <div
                        className="relative"
                        style={{
                            width: "1200px",
                            height: `calc( (1200px * 1.45) * var(--sheet-scale) )`,
                            transform: "scale(var(--sheet-scale))",
                            transformOrigin: "top center",
                        }}
                    >
                        <div
                            id="sheetWrapper"
                            className="absolute top-0 left-0"
                            style={{ width: "1200px" }}
                        >
                            {/* 🎯 Target face ABOVE the scoresheet */}
                            {usedTargetScoring && scoreData.targetImage && (
                                <div className="mb-4 border border-black p-1 flex justify-center bg-white">
                                    <img
                                        src={scoreData.targetImage}
                                        alt="Target placement map"
                                        className="max-h-[500px] w-auto"
                                    />
                                </div>
                            )}
                            <div
                                id="scoresheet"
                                className="bg-white text-black border border-black px-10 py-8 w-[1200px] max-w-none"
                                style={{
                                    fontFamily:
                                        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                }}
                            >
                                {/* Title (round name) */}
                                <h1 className="text-2xl font-bold mb-4">
                                    {scoreData.roundName}
                                </h1>

                                {/* Name / Club / Date / Bowstyle block */}
                                <div className="border border-black text-xs mb-6">
                                    {/* Row 1: Name | Club */}
                                    <div className="grid grid-cols-[1fr,1fr] border-b border-black">
                                        <div className="flex border-r border-black">
                                            <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                                                Name:
                                            </div>
                                            <div className="px-2 py-1 flex-1">
                                                {displayName}
                                            </div>
                                        </div>

                                        <div className="flex">
                                            <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                                                Club:
                                            </div>
                                            <div className="px-2 py-1 flex-1">
                                                {displayClub}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Date | Bowstyle */}
                                    <div className="grid grid-cols-[1fr,1fr]">
                                        <div className="flex border-r border-black">
                                            <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                                                Date:
                                            </div>
                                            <div className="px-2 py-1 flex-1">
                                                {todayStr}
                                            </div>
                                        </div>

                                        <div className="flex">
                                            <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                                                Bowstyle:
                                            </div>
                                            <div className="px-2 py-1 flex-1">
                                                {displayBow}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Portsmouth-style main scoring table */}
                                <div className="mt-2">
                                    <table
                                        className="w-full border-collapse text-xs"
                                        style={{
                                            lineHeight: "1.25rem",
                                            verticalAlign: "middle",
                                            textAlign: "center",
                                        }}
                                    >
                                        <thead>
                                            <tr className="bg-gray-300">
                                                <th className="border border-black px-1 py-1 text-center w-[4%]">
                                                    J
                                                </th>
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <th
                                                        key={`a-${i}`}
                                                        className="border border-black px-1 py-1 text-center w-[5%]"
                                                    >
                                                        {i + 1}
                                                    </th>
                                                ))}
                                                <th className="border border-black px-1 py-1 text-center w-[6%]">
                                                    H.D.
                                                </th>
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <th
                                                        key={`b-${i}`}
                                                        className="border border-black px-1 py-1 text-center w-[5%]"
                                                    >
                                                        {i + 1}
                                                    </th>
                                                ))}
                                                <th className="border border-black px-1 py-1 text-center w-[6%]">
                                                    H.D.
                                                </th>
                                                <th className="border border-black px-1 py-1 text-center w-[85px]">
                                                    Score
                                                </th>
                                                <th className="border border-black px-1 py-1 text-center w-[85px]">
                                                    Hits
                                                </th>
                                                <th className="border border-black px-1 py-1 text-center w-[85px]">
                                                    Golds
                                                </th>
                                                <th className="border border-black px-1 py-1 text-center w-[85px]">
                                                    R.T.
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row.j}>
                                                    <InfoCell bold>&nbsp;</InfoCell>

                                                    {row.arrowValues
                                                        .slice(0, 6)
                                                        .map((val, i) => (
                                                            <ArrowCell
                                                                key={`r${row.j}-a${i}`}
                                                                value={val}
                                                            />
                                                        ))}

                                                    <InfoCell>{row.hd1}</InfoCell>

                                                    {row.arrowValues
                                                        .slice(6, 12)
                                                        .map((val, i) => (
                                                            <ArrowCell
                                                                key={`r${row.j}-b${i}`}
                                                                value={val}
                                                            />
                                                        ))}

                                                    <InfoCell>{row.hd2}</InfoCell>
                                                    <InfoCell>{row.score}</InfoCell>
                                                    <InfoCell>{row.hits}</InfoCell>
                                                    <InfoCell>{row.golds}</InfoCell>
                                                    <InfoCell bold>{row.runningTotal}</InfoCell>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Grand totals strip */}
                                <div className="mt-6 border border-black text-xs grid grid-cols-[3fr,1fr,1fr,1fr,1fr]">
                                    <div className="border-r border-black px-2 py-1 text-right font-semibold bg-gray-300">
                                        Grand Totals:
                                    </div>
                                    <div className="border-r border-black px-1 py-1 text-center">
                                        {totals.score}
                                    </div>
                                    <div className="border-r border-black px-1 py-1 text-center">
                                        {totals.hits}
                                    </div>
                                    <div className="border-r border-black px-1 py-1 text-center">
                                        {totals.golds}
                                    </div>
                                    <div className="px-1 py-1 text-center">-</div>
                                </div>

                                {/* Signature lines (printed version) */}
                                <div id="signature-lines" className="grid grid-cols-2 mt-10 text-xs gap-x-10">
                                    <div className="pt-2 text-left flex items-center">
                                        <span className="font-bold whitespace-nowrap">
                                            Archer’s Signature:
                                        </span>
                                    </div>

                                    <div className="pt-2 text-left flex items-center">
                                        <span className="font-bold whitespace-nowrap">
                                            Scorer’s Signature:
                                        </span>
                                    </div>
                                </div>
                            </div>

                            
                        </div>

                        </div>
                        {/* 🖼️ Buttons + input: follow underneath, but NOT scaled */}
                        {imageUrl && (
                        <div
                            className="w-full flex flex-col items-center gap-3 mt-0"
                            style={{
                                transform: `scale(${buttonScale})`,
                                transformOrigin: "top center",
                            }}
                        >
                                <img src={imageUrl} alt="" className="hidden" />

                                <div className="w-full max-w-sm">
                                    <label className="block text-sm mb-1">
                                        Competition Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={competitionName}
                                        onChange={(e) => setCompetitionName(e.target.value)}
                                        placeholder="Enter competition name"
                                        className="w-full border rounded-md px-3 py-2 text-sm"
                                    />
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 mt-2">
                                    <Button
                                        onClick={() => handleUploadToFeed("informal", imageUrl!)}
                                        disabled={uploading || !imageUrl}
                                    >
                                        Upload Informal
                                    </Button>
                                    <Button
                                        onClick={() => handleFormalOrCompetition("formal")}
                                        disabled={uploading || !imageUrl}
                                    >
                                        Upload Formal
                                    </Button>
                                    <Button
                                        onClick={() => handleFormalOrCompetition("competition")}
                                        disabled={uploading || !imageUrl}
                                    >
                                        Upload Competition
                                    </Button>
                                </div>
                            </div>
                        )}
                    

                    
                </div>
            </Card>

            

            {/* ✍️ Signature Modal (for formal / comp uploads) */}
            {showSignatureModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        className={`p-6 rounded-lg shadow-2xl max-w-lg w-full space-y-4 border transition-all ${isDark
                                ? "bg-neutral-900 border-neutral-700 text-gray-100"
                                : "bg-white border-gray-300 text-gray-900"
                            }`}
                    >
                        <h2 className="text-lg font-semibold text-center">
                            Signatures Required
                        </h2>
                        <p className="text-sm text-center text-muted-foreground">
                            Both the archer and counter-signer must sign before upload.
                        </p>

                        <OptimizedSignaturePad
                            label="Archer"
                            innerRef={sigArcherRef}
                            isDark={isDark}
                        />
                        <OptimizedSignaturePad
                            label="Counter"
                            innerRef={sigCounterRef}
                            isDark={isDark}
                        />

                        <div className="flex justify-between mt-3">
                            <Button
                                variant="outline"
                                className={isDark ? "border-gray-600 text-gray-200" : ""}
                                onClick={() => setShowSignatureModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSaveSignatures}>
                                Save Signatures &amp; Upload
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {uploading && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <p className="text-white mt-4 text-sm font-medium">
                        Uploading score…
                    </p>
                </div>
            )}
        </main>
    );
}