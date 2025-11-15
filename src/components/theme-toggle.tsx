"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";


export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Wait until mounted so it matches client theme
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
        >
            {isDark ? "Light Mode" : "Dark Mode"}
        </button>
    );
}