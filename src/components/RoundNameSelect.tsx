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

    useEffect(() => {
        async function loadRounds() {
            const { data, error } = await supabase.rpc("get_distinct_rounds");
            if (error) return console.error("Error loading rounds:", error);

            const uniqueRounds = (data || [])
                .map((r: { round_name: string | null }) => r.round_name?.trim())
                .filter((r: string | null | undefined): r is string => typeof r === "string" && r.length > 0)
                .sort();

            setRounds(uniqueRounds);
        }
        loadRounds();
    }, [supabase]);

    useEffect(() => setQuery(value), [value]);

    const filtered = !query ? rounds : rounds.filter(r => r.toLowerCase().includes(query.toLowerCase()));

    const handleSelect = (val: string) => {
        setQuery(val);
        setShowList(false);
        setIsValid(true);
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

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Start typing a round name..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowList(true); }}
                onFocus={() => setShowList(true)}
                onBlur={handleBlur}
                className={`w-full rounded-md border px-3 py-2 bg-[hsl(var(--muted))]/20 ${isValid ? "border-[hsl(var(--border))]/40" : "border-red-500 focus:border-red-500"}`}
            />
            {showList && filtered.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-[hsl(var(--border))]/40 bg-[hsl(var(--card))] shadow-sm">
                    {filtered.map((round) => (
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
            {!isValid && <p className="text-xs text-red-500 mt-1">Please select a valid round from the list.</p>}
        </div>
    );
}