"use client";

import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface RoundNameSelectProps {
    value: string;
    onChange?: (val: string) => void;
}

export default function RoundNameSelect({ value, onChange }: RoundNameSelectProps) {
    const [query, setQuery] = useState(value);
    const [showList, setShowList] = useState(false);
    const [rounds, setRounds] = useState<string[]>([]);
    const supabase = useMemo(() => supabaseBrowser(), []);

    /* ---------------------------------------------
       LOAD ROUNDS FROM SUPABASE
    ---------------------------------------------- */
    useEffect(() => {
        async function loadRounds() {
            const { data, error } = await supabase
                .from("handicaps")
                .select("round_name")
                .order("round_name", { ascending: true });

            if (error) {
                console.error("Failed to load rounds:", error);
                return;
            }

            const rows = (data ?? []) as { round_name: string }[];
            const unique = Array.from(new Set(rows.map((r) => r.round_name))).sort();
            setRounds(unique);
        }

        loadRounds();
    }, [supabase]);

    const filteredRounds = useMemo(() => {
        if (!query) return rounds;
        return rounds.filter((round) =>
            round.toLowerCase().includes(query.toLowerCase())
        );
    }, [query, rounds]);

    const handleSelect = (val: string) => {
        setQuery(val);
        setShowList(false);
        onChange?.(val);
    };

    /* ---------------------------------------------
       UI
    ---------------------------------------------- */
    return (
        <div className="relative">
            {/* INPUT */}
            <input
                type="text"
                placeholder="Search round name…"
                value={query}
                onChange={(e) => {
                    const v = e.target.value;
                    setQuery(v);
                    setShowList(true);
                    onChange?.(v);
                }}
                onFocus={() => setShowList(true)}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                className="
                    w-full h-11 px-4 rounded-xl text-sm
                    border border-border/50 
                    bg-background/60 backdrop-blur-xl
                    shadow-sm
                    transition-all
                    focus:outline-none focus:ring-2 
                    focus:ring-emerald-500/70
                    placeholder:text-muted-foreground/70
                "
            />

            {/* DROPDOWN */}
            {showList && filteredRounds.length > 0 && (
                <ul
                    className="
                        absolute z-20 mt-2 w-full 
                        max-h-52 overflow-y-auto 
                        rounded-xl border border-border/50 
                        bg-background/80 backdrop-blur-xl
                        shadow-xl
                        animate-in fade-in-0 zoom-in-95
                    "
                >
                    {filteredRounds.map((round) => (
                        <li
                            key={round}
                            onMouseDown={() => handleSelect(round)}
                            className="
                                px-4 py-2.5 text-sm cursor-pointer
                                hover:bg-emerald-500/10 
                                hover:text-emerald-600
                                transition-colors
                            "
                        >
                            {round}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}