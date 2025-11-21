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

            // ✅ Explicitly cast to correct type
            const rows = (data ?? []) as { round_name: string }[];

            // ✅ Deduplicate and sort round names
            const uniqueRounds = Array.from(
                new Set(rows.map((r) => r.round_name))
            ).sort();

            setRounds(uniqueRounds);
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

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Start typing a round name..."
                value={query}
                onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    setShowList(true);
                    onChange?.(val);
                }}
                onFocus={() => setShowList(true)}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                className="w-full rounded-md border border-[hsl(var(--border))]/40 px-3 py-2 bg-[hsl(var(--muted))]/20"
            />

            {showList && filteredRounds.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm">
                    {filteredRounds.map((round) => (
                        <li
                            key={round}
                            onMouseDown={() => handleSelect(round)}
                            className="px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]/40 cursor-pointer"
                        >
                            {round}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}