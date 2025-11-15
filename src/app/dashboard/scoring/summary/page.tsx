"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import SignaturePad from "react-signature-canvas";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toast } from "sonner";

/* 🧩 Adaptive signature pad */
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
                    className: `border rounded-md w-full h-32 bg-transparent ${isDark ? "border-neutral-700" : "border-gray-300"
                        }`,
                }}
            />
        </div>
    );
}

// 🎯 Colour mapping (World Archery standard)
function getArrowColor(value: string | number, isDark: boolean): string {
    const v = String(value).toUpperCase();

    if (v === "X" || v === "10" || v === "9" || v === "8") return "#FFD700"; // Gold
    if (v === "7" || v === "6") return "#FF4136"; // Red
    if (v === "5" || v === "4") return "#0074D9"; // Blue
    if (v === "3" || v === "2") return "#222"; // Black
    if (v === "1") return isDark ? "#BBB" : "#EEE"; // White/gray
    if (v === "M") return "#2ECC40"; // ✅ Miss (green)
    return isDark ? "#FFF" : "#000";
}

/* 🧷 Pixel-perfect centred number via SVG (html2canvas-safe + target colours) */
function ScoreCell({
    value,
    isDark,
}: {
    value: string | number;
    isDark: boolean;
}) {
    const bgColor = getArrowColor(value, isDark);
    const textColor =
        String(value).toUpperCase() === "M"
            ? "#FFF"
            : bgColor === "#FFD700" || bgColor === "#FF4136" || bgColor === "#0074D9"
                ? "#000"
                : isDark
                    ? "#000"
                    : "#000";

    return (
        <div
            className="w-7 h-7 border rounded overflow-hidden select-none flex items-center justify-center"
            style={{
                backgroundColor: bgColor,
            }}
        >
            <svg
                viewBox="0 0 28 28"
                width="28"
                height="28"
                className="block"
                aria-hidden="true"
            >
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill={textColor}
                >
                    {String(value)}
                </text>
            </svg>
        </div>
    );
}

export default function ScoringSummaryPage() {
    const router = useRouter();
    const supabase = supabaseBrowser();

    const [scoreData, setScoreData] = useState<any | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [competitionName, setCompetitionName] = useState("");
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [pendingFormality, setPendingFormality] = useState<
        "formal" | "competition" | null
    >(null);
    const [isDark, setIsDark] = useState(false);

    const sigArcherRef = useRef<SignaturePad | null>(null);
    const sigCounterRef = useRef<SignaturePad | null>(null);

    /* 🌗 Track color scheme */
    useEffect(() => {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const update = () => setIsDark(mql.matches);
        update();
        mql.addEventListener("change", update);
        return () => mql.removeEventListener("change", update);
    }, []);

    /* 📦 Load score data */
    useEffect(() => {
        const stored = localStorage.getItem("lastScoreData");
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const hits = parsed.ends?.flat()?.filter((v: string | number) => v !== "M")
            .length;
        setScoreData({ ...parsed, hits });
    }, []);

    /* 🎨 Capture scoresheet (wait for layout + fonts) */
    useEffect(() => {
        if (!scoreData) return;
        let cancelled = false;

        const capture = async () => {
            const el = document.getElementById("scoresheet");
            if (!el) return;

            // Wait 2 RAFs so layout/paint fully settle
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve())
                )
            );

            // Wait for fonts to be ready
            if ("fonts" in document) {
                try {
                    // @ts-ignore
                    await (document as any).fonts.ready;
                } catch { }
            }

            const canvas = await html2canvas(el, {
                backgroundColor: null,
                useCORS: true,
                scale: Math.max(2, window.devicePixelRatio || 1),
                logging: false,
                removeContainer: true,
            } as any);

            if (!cancelled) setImageUrl(canvas.toDataURL("image/png"));
        };

        capture();
        return () => {
            cancelled = true;
        };
    }, [scoreData]);

    const handleFormalOrCompetition = (formality: "formal" | "competition") => {
        setPendingFormality(formality);
        setShowSignatureModal(true);
    };

    /* ✍️ Save signatures */
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

            const archerSig = sigArcherRef.current.getTrimmedCanvas();
            const counterSig = sigCounterRef.current.getTrimmedCanvas();

            const img = new Image();
            img.src = imageUrl!;
            await new Promise((r) => (img.onload = r));

            const totalHeight = img.height + 220;
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = totalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context missing.");

            ctx.drawImage(img, 0, 0);
            ctx.fillStyle = isDark ? "white" : "black";
            ctx.font = "16px system-ui, sans-serif";

            const sigY = img.height + 40;
            ctx.drawImage(archerSig, 40, sigY, 250, 100);
            ctx.fillText("Archer Signature", 40, sigY + 120);
            ctx.drawImage(counterSig, 350, sigY, 250, 100);
            ctx.fillText("Counter Signature", 350, sigY + 120);

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

    /* ☁️ Upload to feed */
    async function handleUploadToFeed(
        formality: "formal" | "informal" | "competition",
        signedImageUrl?: string
    ) {
        if (!scoreData || !(signedImageUrl || imageUrl)) return;
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

            const blob = await (await fetch(signedImageUrl || imageUrl!)).blob();
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

    return (
        <main className="max-w-3xl mx-auto p-6 space-y-6">
            {/* 📋 Scorecard */}
            <Card
                id="scoresheet"
                className={`p-4 space-y-4 shadow-md [contain:layout_paint] [isolation:isolate] ${imageUrl ? "hidden" : ""
                    }`}
                style={{
                    fontFamily:
                        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    transition: "none",
                }}
            >
                <CardHeader>
                    <h1 className="text-xl font-semibold text-center">
                        {scoreData.roundName} – {scoreData.total} points
                    </h1>
                    <p className="text-center text-muted-foreground">
                        Golds: {scoreData.golds} | Hits: {scoreData.hits}
                    </p>
                </CardHeader>

                <CardContent className="grid grid-cols-3 gap-3">
                    {scoreData.ends.map((end: any, i: number) => (
                        <div key={i} className="p-2 border rounded-md">
                            <p className="font-semibold text-center">End {i + 1}</p>
                            <div className="flex justify-center gap-[3px] mt-2">
                                {end.map((arrow: string | number, j: number) => (
                                    <ScoreCell key={j} value={arrow} isDark={isDark} />
                                ))}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* 🖼️ Preview + Upload */}
            {imageUrl && (
                <div className="flex flex-col items-center gap-3">
                    <img
                        src={imageUrl}
                        alt="Scoresheet preview"
                        className="w-full rounded-md shadow-md"
                    />

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
                            onClick={() => handleUploadToFeed("informal")}
                            disabled={uploading}
                        >
                            Upload Informal
                        </Button>
                        <Button
                            onClick={() => handleFormalOrCompetition("formal")}
                            disabled={uploading}
                        >
                            Upload Formal
                        </Button>
                        <Button
                            onClick={() => handleFormalOrCompetition("competition")}
                            disabled={uploading}
                        >
                            Upload Competition
                        </Button>
                    </div>
                </div>
            )}

            {/* ✍️ Signature Modal */}
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
                            <Button onClick={handleSaveSignatures}>Save Signatures</Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}