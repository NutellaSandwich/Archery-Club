"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Card } from "@/components/ui/card";
import { getAllRounds } from "@/lib/rounds";

// ============ TYPES ============
type RoundInfo = {
    name: string;
    max_score: number;
    metadata: {
        total_arrows: number;
        arrows_per_end: number;
        ends: number;
        face: string;
        indoor: boolean;
    } | null;
};

type ScoresheetProps = {
    roundName: string;
    archerName: string;
    clubName: string;
    bowstyle: string;
    dateStr: string;
    numRows: number;
};

// ============ SCORE SHEET TEMPLATE (unchanged for print safety) ============
function ScoresheetTemplate({
    roundName,
    archerName,
    clubName,
    bowstyle,
    dateStr,
    numRows,
}: ScoresheetProps) {
    const rows = Array.from({ length: numRows });

    return (
        <div
            className="bg-white text-black border border-black px-10 py-8 w-[1200px]"
            style={{
                fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            {/* TITLE */}
            <h1 className="text-2xl font-bold mb-4">{roundName}</h1>

            {/* ARCHER INFO */}
            <div className="border border-black text-xs mb-6">
                <div className="grid grid-cols-2 border-b border-black">
                    <div className="flex border-r border-black">
                        <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                            Name:
                        </div>
                        <div className="px-2 py-1 flex-1">{archerName}</div>
                    </div>
                    <div className="flex">
                        <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                            Club:
                        </div>
                        <div className="px-2 py-1 flex-1">{clubName}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2">
                    <div className="flex border-r border-black">
                        <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                            Date:
                        </div>
                        <div className="px-2 py-1 flex-1">{dateStr}</div>
                    </div>
                    <div className="flex">
                        <div className="bg-gray-300 font-semibold px-2 py-1 w-[120px] border-r border-black">
                            Bowstyle:
                        </div>
                        <div className="px-2 py-1 flex-1">{bowstyle}</div>
                    </div>
                </div>
            </div>

            {/* MAIN TABLE */}
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
                            {Array.from({ length: 5 }).map((__, i) => (
                                <th
                                    key={`tail-${i}`}
                                    className="border border-black px-1 py-1 text-center w-[6%]"
                                >
                                    &nbsp;
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                <td className="border border-black py-1">&nbsp;</td>
                                {Array.from({ length: 12 }).map((__, i) => (
                                    <td
                                        key={`${rowIndex}-${i}`}
                                        className="border border-black py-1"
                                    >
                                        &nbsp;
                                    </td>
                                ))}
                                {Array.from({ length: 5 }).map((__, i) => (
                                    <td
                                        key={`extra-${rowIndex}-${i}`}
                                        className="border border-black py-1"
                                    >
                                        &nbsp;
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* GRAND TOTALS */}
            <div className="mt-6 border border-black text-xs grid grid-cols-[3fr,1fr,1fr,1fr,1fr]">
                <div className="border-r border-black px-2 py-1 font-semibold bg-gray-300 text-right">
                    Grand Totals:
                </div>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="border-r border-black py-1 text-center">
                        &nbsp;
                    </div>
                ))}
            </div>

            {/* SIGNATURES */}
            <div className="grid grid-cols-2 mt-10 text-xs gap-x-10">
                <div className="pt-2 font-bold">Archer’s Signature:</div>
                <div className="pt-2 font-bold">Scorer’s Signature:</div>
            </div>
        </div>
    );
}

// ============ PAGE COMPONENT ============
export default function ScoresheetGeneratorPage() {
    const [rounds] = useState<RoundInfo[]>(getAllRounds() as RoundInfo[]);
    const [selectedRound, setSelectedRound] = useState<RoundInfo | null>(null);

    // Prefill 1
    const [archerName1, setArcherName1] = useState("");
    const [clubName1, setClubName1] = useState("");
    const [bowstyle1, setBowstyle1] = useState("");
    const [dateStr1, setDateStr1] = useState("");

    // Prefill 2
    const [archerName2, setArcherName2] = useState("");
    const [clubName2, setClubName2] = useState("");
    const [bowstyle2, setBowstyle2] = useState("");
    const [dateStr2, setDateStr2] = useState("");

    const [twoPerPage, setTwoPerPage] = useState(false);
    const [copyDetailsToSecond, setCopyDetailsToSecond] = useState(true);

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const [sheetScale, setSheetScale] = useState(1);
    const [showDropdown, setShowDropdown] = useState(false);
    const [roundQuery, setRoundQuery] = useState("");

    // Close dropdown on outside click
    useEffect(() => {
        const handler = () => setShowDropdown(false);
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, []);

    // Auto-scale preview
    useEffect(() => {
        function updateScale() {
            const targetWidth = 1200;
            const available = window.innerWidth - 32;
            const scale = Math.min(1, available / targetWidth);
            document.documentElement.style.setProperty("--sheet-scale", String(scale));
            setSheetScale(scale);
        }
        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);

    // Copy sheet 1 → sheet 2 if toggle enabled
    useEffect(() => {
        if (!copyDetailsToSecond) return;
        setArcherName2(archerName1);
        setClubName2(clubName1);
        setBowstyle2(bowstyle1);
        setDateStr2(dateStr1);
    }, [copyDetailsToSecond, archerName1, clubName1, bowstyle1, dateStr1]);

    const totalArrows = selectedRound?.metadata?.total_arrows ?? 0;
    const numRows = totalArrows > 0 ? Math.ceil(totalArrows / 12) : 5;

    const filteredRounds = rounds.filter((r) =>
        (roundQuery || selectedRound?.name || "")
            .toLowerCase()
            .split(" ")
            .every((p) => r.name.toLowerCase().includes(p))
    );

    // PDF export
    async function handleGeneratePDF() {
        if (!sheetRef.current || !selectedRound) return;

        const wrapper = sheetRef.current.parentElement as HTMLElement | null;
        const originalTransform = wrapper?.style.transform ?? "";
        const originalScale = sheetScale;

        if (wrapper) wrapper.style.transform = "scale(1)";
        document.documentElement.style.setProperty("--sheet-scale", "1");

        await new Promise((resolve) => requestAnimationFrame(resolve));

        const canvas = await html2canvas(sheetRef.current, {
            backgroundColor: "#ffffff",
            scale: 3,
            useCORS: true,
        });

        if (wrapper) wrapper.style.transform = originalTransform;
        document.documentElement.style.setProperty(
            "--sheet-scale",
            String(originalScale)
        );

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        let renderWidth = pageWidth - 40;
        let renderHeight = (canvas.height * renderWidth) / canvas.width;

        let x = 20;
        let y = 20;

        if (renderHeight > pageHeight - 40) {
            renderHeight = pageHeight - 40;
            renderWidth = (canvas.width * renderHeight) / canvas.height;
            x = (pageWidth - renderWidth) / 2;
        }

        pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
        const blobUrl = URL.createObjectURL(pdf.output("blob"));
        window.open(blobUrl, "_blank");
    }

    return (
        <main className="max-w-5xl mx-auto mt-10 p-4 sm:p-6 space-y-8">

            {/* PAGE TITLE */}
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold">Scoresheet PDF Generator</h1>
                <div className="mx-auto w-48 h-1 rounded-full 
    bg-gradient-to-r from-emerald-600/50 via-sky-500/50 to-emerald-600/50 mb-2" />

                {selectedRound?.metadata && (
                    <p className="text-sm text-muted-foreground">
                        {selectedRound.metadata.face}cm •{" "}
                        {selectedRound.metadata.indoor ? "Indoor" : "Outdoor"} •{" "}
                        {selectedRound.metadata.total_arrows} arrows
                    </p>
                )}
            </div>

            {/* CONTROL PANEL */}
            <Card
    className="
        relative p-6 space-y-8 rounded-2xl 
        border border-border/50 bg-card/60 shadow-sm
        before:absolute before:inset-0 before:-z-10
        before:bg-gradient-to-r before:from-emerald-600/10 
        before:via-sky-500/10 before:to-emerald-600/10 
        before:rounded-2xl
    "
>

                {/* ROUND SELECT */}
                <div className="mx-auto w-full h-px 
    bg-gradient-to-r from-emerald-600/40 via-sky-500/40 to-emerald-600/40" />
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Round</label>

                    <div className="relative">
                        <input
                            type="text"
                            value={roundQuery || selectedRound?.name || ""}
                            placeholder="Search for a round..."
                            onChange={(e) => {
                                setRoundQuery(e.target.value);
                                setShowDropdown(true);
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(true);
                            }}
                            className="w-full rounded-xl border border-border/60 bg-muted/20 h-10 px-3 text-sm focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                        />

                        {showDropdown && filteredRounds.length > 0 && (
                            <ul
                                className="absolute z-20 mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-card shadow-lg text-sm"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {filteredRounds.slice(0, 40).map((r) => (
                                    <li
                                        key={r.name}
                                        onMouseDown={() => {
                                            setSelectedRound(r);
                                            setRoundQuery(r.name);
                                            setShowDropdown(false);
                                        }}
                                        className="px-3 py-2 cursor-pointer hover:bg-muted/40"
                                    >
                                        {r.name}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {showDropdown && filteredRounds.length === 0 && (
                            <div
                                className="absolute z-20 mt-2 w-full rounded-xl border border-border/60 bg-card shadow px-3 py-2 text-xs text-muted-foreground"
                                onClick={(e) => e.stopPropagation()}
                            >
                                No matching rounds.
                            </div>
                        )}
                    </div>
                </div>

                {/* LAYOUT OPTIONS */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                            type="checkbox"
                            checked={twoPerPage}
                            onChange={(e) => setTwoPerPage(e.target.checked)}
                        />
                        Two scoresheets per page
                    </label>

                    {twoPerPage && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={copyDetailsToSecond}
                                onChange={(e) => setCopyDetailsToSecond(e.target.checked)}
                            />
                            Copy details from scoresheet 1 → 2
                        </label>
                    )}
                </div>

                {/* SHEET 1 DETAILS */}
                <div className="
    space-y-3 border rounded-xl border-border/40 bg-muted/10 p-4
    relative
">
                    <div className="absolute -top-[1px] inset-x-0 h-px 
        bg-gradient-to-r from-emerald-600 via-sky-500 to-emerald-600" />
                    <p className="font-medium text-sm">Scoresheet 1 Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            value={archerName1}
                            onChange={(e) => setArcherName1(e.target.value)}
                            placeholder="Archer Name"
                            className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm"
                        />
                        <input
                            value={clubName1}
                            onChange={(e) => setClubName1(e.target.value)}
                            placeholder="Club"
                            className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm"
                        />
                        <input
                            value={bowstyle1}
                            onChange={(e) => setBowstyle1(e.target.value)}
                            placeholder="Bowstyle"
                            className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={dateStr1}
                            onChange={(e) => setDateStr1(e.target.value)}
                            className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                {/* SHEET 2 DETAILS (if enabled) */}
                {twoPerPage && (
                    <div className="
    space-y-3 border rounded-xl border-border/40 bg-muted/10 p-4
    relative
">
                        <div className="absolute -top-[1px] inset-x-0 h-px 
        bg-gradient-to-r from-emerald-600 via-sky-500 to-emerald-600" />
                        <p className="font-medium text-sm">Scoresheet 2 Details</p>
                        <p className="text-xs text-muted-foreground">
                            {copyDetailsToSecond
                                ? "Currently copying all details from sheet 1."
                                : "You may edit independently."}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                value={archerName2}
                                onChange={(e) => {
                                    setArcherName2(e.target.value);
                                    setCopyDetailsToSecond(false);
                                }}
                                placeholder="Archer Name"
                                disabled={copyDetailsToSecond}
                                className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm disabled:opacity-50"
                            />
                            <input
                                value={clubName2}
                                onChange={(e) => {
                                    setClubName2(e.target.value);
                                    setCopyDetailsToSecond(false);
                                }}
                                placeholder="Club"
                                disabled={copyDetailsToSecond}
                                className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm disabled:opacity-50"
                            />
                            <input
                                value={bowstyle2}
                                onChange={(e) => {
                                    setBowstyle2(e.target.value);
                                    setCopyDetailsToSecond(false);
                                }}
                                placeholder="Bowstyle"
                                disabled={copyDetailsToSecond}
                                className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm disabled:opacity-50"
                            />
                            <input
                                type="date"
                                value={dateStr2}
                                onChange={(e) => {
                                    setDateStr2(e.target.value);
                                    setCopyDetailsToSecond(false);
                                }}
                                disabled={copyDetailsToSecond}
                                className="rounded-md border bg-muted/20 border-border/40 px-3 py-2 text-sm disabled:opacity-50"
                            />
                        </div>
                    </div>
                )}

                <Button
                    onClick={handleGeneratePDF}
                    disabled={!selectedRound}
                    className="
        w-full rounded-xl 
        bg-gradient-to-r from-emerald-600 to-sky-500 
        text-white shadow-md
        hover:opacity-90 transition
    "
                >
                    Generate PDF
                </Button>
            </Card>

            <div className="mx-auto w-64 h-[2px] my-8 
    bg-gradient-to-r from-emerald-600/40 via-sky-500/40 to-emerald-600/40" />
            {selectedRound && (
                <div className="w-full flex justify-center">
                    <div className="relative h-fit w-[1200px] flex justify-center mt-10">
                        <div
                            className="h-fit"
                            style={{
                                transform: `scale(var(--sheet-scale))`,
                                transformOrigin: "top center",
                            }}
                        >
                            <div
                                ref={sheetRef}
                                className="w-[1200px] bg-white flex flex-col"
                                style={{
                                    height: twoPerPage ? "1684px" : "auto",
                                    padding: twoPerPage ? "40px 0" : "0",
                                }}
                            >
                                {/* SHEET 1 */}
                                <div className={twoPerPage ? "flex-1 flex justify-center" : ""}>
                                    <ScoresheetTemplate
                                        roundName={selectedRound.name}
                                        archerName={archerName1}
                                        clubName={clubName1}
                                        bowstyle={bowstyle1}
                                        dateStr={dateStr1}
                                        numRows={numRows}
                                    />
                                </div>

                                {twoPerPage && <div className="flex-1" />}

                                {/* SHEET 2 */}
                                {twoPerPage && (
                                    <div className="flex-1 flex justify-center">
                                        <ScoresheetTemplate
                                            roundName={selectedRound.name}
                                            archerName={archerName2}
                                            clubName={clubName2}
                                            bowstyle={bowstyle2}
                                            dateStr={dateStr2}
                                            numRows={numRows}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}