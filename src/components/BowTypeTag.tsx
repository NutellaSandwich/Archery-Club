export default function BowTypeTag({ bow }: { bow: string }) {
    const b = bow.toLowerCase();

    const color =
        b === "recurve"
            ? "from-red-900 to-red-700"
            : b === "compound"
                ? "from-blue-900 to-blue-700"
                : b === "barebow"
                    ? "from-green-900 to-green-700"
                    : b === "longbow"
                        ? "from-amber-900 to-amber-700"
                        : "from-gray-800 to-gray-600";

    return (
        <span
            className={`px-4 py-1 rounded-full text-white text-xs font-semibold tracking-wide
                        bg-gradient-to-b ${color}
                        shadow-[0_4px_10px_rgba(0,0,0,0.4)] border border-white/10
                        ring-1 ring-black/40
                        hover:shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-all duration-200
                        backdrop-blur-sm`}
        >
            {bow}
        </span>
    );
}