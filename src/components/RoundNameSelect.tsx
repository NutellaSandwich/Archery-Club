"use client";
import { useMemo, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function RoundNameSelect({
    value,
    onChange,
}: { value: string; onChange?: (val: string) => void }) {
    const [query, setQuery] = useState(value);
    const [showList, setShowList] = useState(false);
    const [isValid, setIsValid] = useState(true);
    const [rounds, setRounds] = useState<string[]>([]);
    const supabase = useMemo(() => supabaseBrowser(), []);

    /* ----------------------------
       Load rounds
    ----------------------------- */
    useEffect(() => {
        async function loadRounds() {
            const { data, error } = await supabase.rpc("get_distinct_rounds");
            if (error) return console.error("Error loading rounds:", error);

            // Explicit RPC return type
            type RoundRow = { round_name: string | null };

            const uniqueRounds = ((data ?? []) as RoundRow[])
                .map((r: RoundRow) => r.round_name?.trim() || "")
                .filter((r: string) => r.length > 0)
                .sort();

            setRounds(uniqueRounds);
        }
        loadRounds();
    }, [supabase]);

    useEffect(() => setQuery(value), [value]);

    const filtered =
        !query ? rounds : rounds.filter(r => r.toLowerCase().includes(query.toLowerCase()));

    /* ----------------------------
       Selection + Validation
    ----------------------------- */
    const handleSelect = (val: string) => {
        setQuery(val);
        setIsValid(true);
        setShowList(false);
        onChange?.(val);
    };

    const handleBlur = () => {
        const matched = rounds.some(r => r.toLowerCase() === query.trim().toLowerCase());
        if (!matched) {
            setIsValid(false);
            setQuery("");
            onChange?.("");
        } else {
            setIsValid(true);
        }
        setTimeout(() => setShowList(false), 150);
    };

    /* ----------------------------
       UI
    ----------------------------- */
    return (
        <div className="relative">
            {/* INPUT */}
            <input
                type="text"
                placeholder="Start typing a round name…"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                onBlur={handleBlur}
                className={`
                    w-full h-11 px-4 rounded-xl text-sm
                    bg-background/60 backdrop-blur-xl
                    border transition-all shadow-sm 
                    placeholder:text-muted-foreground/70

                    ${isValid
                        ? "border-border/50 focus:ring-2 focus:ring-emerald-500/60"
                        : "border-red-500 focus:ring-2 focus:ring-red-500/50"
                    }
                `}
            />

            {/* DROPDOWN */}
            {showList && filtered.length > 0 && (
                <ul
                    className="
                        absolute z-20 mt-2 w-full max-h-52 overflow-y-auto 
                        rounded-xl border border-border/50 
                        bg-background/80 backdrop-blur-xl
                        shadow-xl
                        animate-in fade-in-0 zoom-in-95
                    "
                >
                    {filtered.map((round) => (
                        <li
                            key={round}
                            onMouseDown={() => handleSelect(round)}
                            className="
                                px-4 py-2.5 text-sm cursor-pointer
                                hover:bg-emerald-500/10 hover:text-emerald-600
                                transition-colors
                            "
                        >
                            {round}
                        </li>
                    ))}
                </ul>
            )}

            {/* INVALID MESSAGE */}
            {!isValid && (
                <p className="text-xs text-red-500 mt-1">
                    Please select a valid round from the list.
                </p>
            )}
        </div>
    );
}