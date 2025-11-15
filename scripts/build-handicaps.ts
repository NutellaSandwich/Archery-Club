import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createObjectCsvWriter } from "csv-writer";

interface HandicapRecord {
    round_name: string;
    round_type: "indoor" | "outdoor";
    system: "imperial" | "metric";
    bow_type: "recurve" | "barebow" | "longbow" | "compound";
    bow_group: "non-compound" | "compound" | "all";
    spot_type: "single" | "triple" | null;
    score: number;
    handicap: number;
}

/** Convert sheet to JSON rows (raw array form) */
function sheetToArray(filePath: string, sheetName?: string): any[][] {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}

/** Parse outdoor (imperial or metric) where: 
 *  Column 0 = handicap, others = round names
 */
function parseOutdoor(
    filePath: string,
    system: "imperial" | "metric"
): HandicapRecord[] {
    const rows = sheetToArray(filePath);
    const headers = rows[0].slice(1); // round names
    const results: HandicapRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const handicap = Number(row[0]);
        if (isNaN(handicap)) continue;

        for (let j = 1; j < headers.length; j++) {
            const round_name = String(headers[j - 1]).trim();
            const score = Number(row[j]);
            if (!round_name || isNaN(score)) continue;

            // non-compound + compound same data
            results.push({
                round_name,
                round_type: "outdoor",
                system,
                bow_type: "recurve",
                bow_group: "non-compound",
                spot_type: null,
                score,
                handicap,
            });
            results.push({
                ...results[results.length - 1],
                bow_type: "compound",
                bow_group: "compound",
            });
        }
    }

    console.log(`Parsed ${results.length} outdoor (${system}) records`);
    return results;
}

function parseIndoor(filePath: string): HandicapRecord[] {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    // First row contains combined headers (like "Non-Compound, Bray I, Full Size")
    const headers = raw[0];
    const dataRows = raw.slice(1);

    const results: HandicapRecord[] = [];

    for (const row of dataRows) {
        const handicap = Number(row[0]);
        if (isNaN(handicap)) continue;

        // Each column (after first) contains a score for a given combo
        for (let i = 1; i < headers.length; i++) {
            const headerText = String(headers[i] || "").trim();
            const score = Number(row[i]);
            if (!score || isNaN(score) || !headerText) continue;

            // Split header: "Non-Compound, Bray I, Full Size"
            const parts = headerText.split(",").map((p) => p.trim());
            const bowGroupRaw = (parts[0] || "").toLowerCase();
            const roundName = parts[1] || "";
            const spotRaw = (parts[2] || "").toLowerCase();

            if (!roundName) continue;

            const isAllBows = bowGroupRaw.includes("all");
            let bowGroups: ("compound" | "non-compound")[];

            if (isAllBows) {
                bowGroups = ["compound", "non-compound"];
            } else if (bowGroupRaw.includes("non")) {
                bowGroups = ["non-compound"];
            } else if (bowGroupRaw.includes("compound")) {
                bowGroups = ["compound"];
            } else {
                bowGroups = ["non-compound"]; // default fallback
            }

            // Determine spot type
            let spot_type: "single" | "triple" = "single";
            if (spotRaw.includes("triple")) spot_type = "triple";

            // Expand to all bow types
            for (const bow_group of bowGroups) {
                const bowTypes =
                    bow_group === "compound"
                        ? (["compound"] as const)
                        : (["recurve", "barebow", "longbow"] as const);

                for (const bow_type of bowTypes) {
                    results.push({
                        round_name: roundName,
                        round_type: "indoor",
                        system: "metric",
                        bow_type,
                        bow_group,
                        spot_type,
                        score,
                        handicap,
                    });
                }
            }
        }
    }

    const tripleCount = results.filter((r) => r.spot_type === "triple").length;
    const singleCount = results.filter((r) => r.spot_type === "single").length;
    console.log(
        `✅ Parsed ${results.length} indoor records (${tripleCount} triple, ${singleCount} full/single)`
    );

    return results;
}

async function main() {
    const dataDir = path.resolve("data");
    const imperialPath = path.join(
        dataDir,
        "Table 1 imperial outdoor rounds - score for round.xlsx"
    );
    const metricPath = path.join(
        dataDir,
        "Table 2 - WA and ArcheryGB Metric Outdoor Rounds - score for round.xlsx"
    );
    const indoorPath = path.join(
        dataDir,
        "Table 3 Indoor rounds - score for round.xlsx"
    );

    const imperial = parseOutdoor(imperialPath, "imperial");
    const metric = parseOutdoor(metricPath, "metric");
    const indoor = parseIndoor(indoorPath);

    const all = [...imperial, ...metric, ...indoor];
    const outputPath = path.resolve(dataDir, "handicaps.csv");

    const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: [
            { id: "round_name", title: "round_name" },
            { id: "round_type", title: "round_type" },
            { id: "system", title: "system" },
            { id: "bow_type", title: "bow_type" },
            { id: "bow_group", title: "bow_group" },
            { id: "spot_type", title: "spot_type" },
            { id: "score", title: "score" },
            { id: "handicap", title: "handicap" },
        ],
    });

    await csvWriter.writeRecords(all);
    console.log(`✅ Created ${all.length} handicap records`);
    console.log(`📄 Output: ${outputPath}`);
}

main().catch((err) => console.error("❌ Error:", err));