export default function BowTypeTag({ bow }: { bow: string }) {
    const b = bow.toLowerCase();

    const color =
        b === "recurve"
            ? "from-red-700 to-red-500"
            : b === "compound"
                ? "from-blue-700 to-blue-500"
                : b === "barebow"
                    ? "from-green-700 to-green-500"
                    : b === "longbow"
                        ? "from-amber-700 to-amber-500"
                        : "from-gray-700 to-gray-500";

    return (
        <span
            className={`px-4 py-1 rounded-full text-white text-xs font-semibold tracking-wide
                        bg-gradient-to-b ${color}
                        shadow-[0_3px_6px_rgba(0,0,0,0.35)] border border-white/10
                        hover:shadow-[0_5px_10px_rgba(0,0,0,0.45)] transition-all duration-200`}
        >
            {bow}
        </span>
    );
}