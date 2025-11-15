// /lib/rounds.ts
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

export function getRoundMaxScore(roundName?: string | null) {
    if (!roundName) return null;
    const direct = ROUND_MAX_SCORES[roundName];
    if (direct) return direct;

    const norm = roundName.trim().toLowerCase();
    const key = Object.keys(ROUND_MAX_SCORES).find(
        k => k.trim().toLowerCase() === norm
    );
    return key ? ROUND_MAX_SCORES[key] : null;
}