export default function BowTypeTag({ bow }: { bow: string }) {
    const b = bow.toLowerCase();

    const color =
        b === "recurve"
            ? "bg-red-500"
            : b === "compound"
                ? "bg-blue-500"
                : b === "barebow"
                    ? "bg-green-600"
                    : b === "longbow"
                        ? "bg-amber-600"
                        : "bg-gray-500";

    return (
        <span
            className={`px-4 py-1 rounded-full text-white text-xs font-medium tracking-wide ${color}`}
        >
            {bow}
        </span>
    );
}