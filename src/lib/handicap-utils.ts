import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Lookup the handicap for a given round, bow, score, and spot type.
 */
export async function getHandicapForScore({
    round_name,
    bow_type,
    score,
    spot_type = "single",
}: {
    round_name: string;
    bow_type: "recurve" | "barebow" | "longbow" | "compound";
    score: number;
    spot_type?: "single" | "triple";
}) {
    const supabase = supabaseBrowser();

    // Determine bow group
    const bow_group =
        bow_type === "compound" ? "compound" : "non-compound";

    const { data, error } = await supabase
        .from("handicaps")
        .select("handicap")
        .eq("round_name", round_name)
        .eq("bow_type", bow_type)
        .eq("bow_group", bow_group)
        .eq("spot_type", spot_type)
        .lte("score", score)
        .order("score", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Handicap lookup failed:", error);
        return null;
    }

    return data?.handicap ?? null;
}