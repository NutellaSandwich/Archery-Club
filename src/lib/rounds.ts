// ======================
// ROUND MAX SCORES (KEEPING YOUR ORIGINAL DATA)
// ======================
export const ROUND_MAX_SCORES: Record<string, number> = {
    // AGB 900 Rounds
    "AGB 900-30": 900,
    "AGB 900-40": 900,
    "AGB 900-50": 900,
    "AGB 900-70": 900,

    // Traditional Imperial Rounds
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

    // Metric (Outdoor) Rounds
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

    // WA & Metric Combined
    "WA 1440 (90m)": 1440,
    "WA 1440 (60m) / Metric II": 1440,
    "WA 900": 900,
    "WA 70m": 720,
    "WA 60m": 720,
    "WA 50m (Compound)": 720,
    "WA 50m (Barebow) / Metric 122-50": 720,
    "WA Standard Bow": 720,

    // Indoor Rounds
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



// ======================
// ROUND METADATA
// ======================

// Every round now has:
// - total arrows
// - arrows per end
// - number of ends
// - face type (122cm/80cm/triple/Worcester/etc.)
// - indoor/outdoor
export type RoundMetadata = {
    name: string;
    total_arrows: number;
    arrows_per_end: number;
    ends: number;
    face: "122" | "80" | "60" | "40" | "Vegas" | "Worcester" | "Triple" | "Unknown";
    indoor: boolean;
};

export const ROUND_METADATA: Record<string, RoundMetadata> = {

    // ======================
    // AGB 900 ROUNDS (Outdoor)
    // ======================
    "AGB 900-30": {
        name: "AGB 900-30",
        total_arrows: 90,
        arrows_per_end: 6,
        ends: 15,
        face: "122",
        indoor: false,
    },
    "AGB 900-40": {
        name: "AGB 900-40",
        total_arrows: 90,
        arrows_per_end: 6,
        ends: 15,
        face: "122",
        indoor: false,
    },
    "AGB 900-50": {
        name: "AGB 900-50",
        total_arrows: 90,
        arrows_per_end: 6,
        ends: 15,
        face: "122",
        indoor: false,
    },
    "AGB 900-70": {
        name: "AGB 900-70",
        total_arrows: 90,
        arrows_per_end: 6,
        ends: 15,
        face: "122",
        indoor: false,
    },


    // ======================
    // TRADITIONAL IMPERIAL ROUNDS (Outdoor)
    // (All use 5-zone scoring, full-size faces)
    // ======================

    // York family (6 dozen + 4 dozen + 2 dozen = 144 arrows)
    "York": {
        name: "York",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },

    "Hereford / Bristol I": {
        name: "Hereford / Bristol I",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Bristol II": {
        name: "Bristol II",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Bristol III": {
        name: "Bristol III",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Bristol IV": {
        name: "Bristol IV",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Bristol V": {
        name: "Bristol V",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },

    // Albion & St George (3 dozen each = 9 dozen = 108 arrows)
    "Albion": {
        name: "Albion",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },
    "St George": {
        name: "St George",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },

    // American (30 arrows per distance, 90 total)
    "American": {
        name: "American",
        total_arrows: 90,
        arrows_per_end: 5,
        ends: 18,
        face: "122",
        indoor: false,
    },

    // National family (4 dozen + 2 dozen = 72 arrows)
    "New National": {
        name: "New National",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "Long National": {
        name: "Long National",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "National": {
        name: "National",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "National 50": {
        name: "National 50",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "National 40": {
        name: "National 40",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "National 30": {
        name: "National 30",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },

    // Western family (4 dozen + 4 dozen = 96 arrows)
    "New Western": {
        name: "New Western",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },
    "Long Western": {
        name: "Long Western",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },
    "Western": {
        name: "Western",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },
    "Western 50": {
        name: "Western 50",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },
    "Western 40": {
        name: "Western 40",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },
    "Western 30": {
        name: "Western 30",
        total_arrows: 96,
        arrows_per_end: 6,
        ends: 16,
        face: "122",
        indoor: false,
    },

    // Warwick family (2 dozen + 2 dozen = 48 arrows)
    "New Warwick": {
        name: "New Warwick",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },
    "Long Warwick": {
        name: "Long Warwick",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },
    "Warwick": {
        name: "Warwick",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },
    "Warwick 50": {
        name: "Warwick 50",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },
    "Warwick 40": {
        name: "Warwick 40",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },

    "St Nicholas": {
        name: "St Nicholas",
        total_arrows: 48,
        arrows_per_end: 6,
        ends: 8,
        face: "122",
        indoor: false,
    },

    // Windsor family (3 dozen + 3 dozen + 3 dozen = 108 arrows)
    "Windsor": {
        name: "Windsor",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },
    "Windsor 50": {
        name: "Windsor 50",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },
    "Windsor 40": {
        name: "Windsor 40",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },
    "Windsor 30": {
        name: "Windsor 30",
        total_arrows: 108,
        arrows_per_end: 6,
        ends: 18,
        face: "122",
        indoor: false,
    },


    // ======================
    // METRIC OUTDOOR ROUNDS
    // (10-zone scoring, various faces)
    // ======================

    "Metric 122-30": {
        name: "Metric 122-30",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "Metric 122-40": {
        name: "Metric 122-40",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "Metric 80-40": {
        name: "Metric 80-40",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "80",
        indoor: false,
    },

    // Metric III–V (144 arrows)
    "Metric III": {
        name: "Metric III",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Metric IV": {
        name: "Metric IV",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Metric V": {
        name: "Metric V",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },

    // Short Metrics (72 arrows)
    "Short Metric": {
        name: "Short Metric",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "80",
        indoor: false,
    },
    "Short Metric I": {
        name: "Short Metric I",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "80",
        indoor: false,
    },
    "Short Metric II": {
        name: "Short Metric II",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "80",
        indoor: false,
    },
    "Short Metric III": {
        name: "Short Metric III",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "Short Metric IV": {
        name: "Short Metric IV",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },
    "Short Metric V": {
        name: "Short Metric V",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },

    // Long Metrics (144 arrows)
    "Long Metric (Men)": {
        name: "Long Metric (Men)",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Long Metric (Women) / 1": {
        name: "Long Metric (Women) / 1",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Long Metric II": {
        name: "Long Metric II",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Long Metric III": {
        name: "Long Metric III",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Long Metric IV": {
        name: "Long Metric IV",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "Long Metric V": {
        name: "Long Metric V",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },


    // ======================
    // WA / COMBINED METRIC ROUNDS
    // ======================

    "WA 1440 (90m)": {
        name: "WA 1440 (90m)",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },
    "WA 1440 (60m) / Metric II": {
        name: "WA 1440 (60m) / Metric II",
        total_arrows: 144,
        arrows_per_end: 6,
        ends: 24,
        face: "122",
        indoor: false,
    },

    "WA 900": {
        name: "WA 900",
        total_arrows: 90,
        arrows_per_end: 6,
        ends: 15,
        face: "122",
        indoor: false,
    },

    "WA 70m": {
        name: "WA 70m",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },

    "WA 60m": {
        name: "WA 60m",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },

    "WA 50m (Compound)": {
        name: "WA 50m (Compound)",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "80",
        indoor: false,
    },
    "WA 50m (Barebow) / Metric 122-50": {
        name: "WA 50m (Barebow) / Metric 122-50",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },

    "WA Standard Bow": {
        name: "WA Standard Bow",
        total_arrows: 72,
        arrows_per_end: 6,
        ends: 12,
        face: "122",
        indoor: false,
    },


    // ======================
    // INDOOR ROUNDS (Full list)
    // ======================

    "Stafford": {
        name: "Stafford",
        total_arrows: 72,
        arrows_per_end: 3,
        ends: 24,
        face: "60",
        indoor: true,
    },

    "WA 18m or Vegas": {
        name: "WA 18m or Vegas",
        total_arrows: 60,
        arrows_per_end: 3,
        ends: 20,
        face: "Vegas",
        indoor: true,
    },

    // ======================
    // INDOOR ROUNDS (Missing)
    // ======================

    "Portsmouth": {
        name: "Portsmouth",
        total_arrows: 60,
        arrows_per_end: 3,
        ends: 20,
        face: "60",
        indoor: true,
    },

    "Worcester": {
        name: "Worcester",
        total_arrows: 60,
        arrows_per_end: 5,
        ends: 12,
        face: "Worcester",
        indoor: true,
    },

    "Bray I": {
        name: "Bray I",
        total_arrows: 30,
        arrows_per_end: 3,
        ends: 10,
        face: "40",
        indoor: true,
    },

    "Bray II": {
        name: "Bray II",
        total_arrows: 30,
        arrows_per_end: 3,
        ends: 10,
        face: "40",
        indoor: true,
    },

    "WA 18m": {
        name: "WA 18m",
        total_arrows: 60,
        arrows_per_end: 3,
        ends: 20,
        face: "40",   // triple 40 option is typical, but 40cm default is correct
        indoor: true,
    },

    "WA 25m": {
        name: "WA 25m",
        total_arrows: 60,
        arrows_per_end: 3,
        ends: 20,
        face: "60",
        indoor: true,
    },
};


// ======================
// HELPERS
// ======================

// 1) Safe lookup: max score
export function getRoundMaxScore(roundName?: string | null) {
    if (!roundName) return null;
    const direct = ROUND_MAX_SCORES[roundName];
    if (direct) return direct;

    const norm = roundName.trim().toLowerCase();
    const key = Object.keys(ROUND_MAX_SCORES).find(
        (k) => k.trim().toLowerCase() === norm
    );
    return key ? ROUND_MAX_SCORES[key] : null;
}

// 2) Safe lookup: metadata
export function getRoundMetadata(roundName?: string | null): RoundMetadata | null {
    if (!roundName) return null;
    return ROUND_METADATA[roundName] ?? null;
}

// 3) NEW: return unified list of rounds merged with metadata + max score
export function getAllRounds() {
    return Object.keys(ROUND_MAX_SCORES).map((name) => ({
        name,
        max_score: ROUND_MAX_SCORES[name],
        metadata: ROUND_METADATA[name] ?? null,
    }));
}