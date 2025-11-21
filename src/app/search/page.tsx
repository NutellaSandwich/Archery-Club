interface SearchPageProps {
    searchParams: {
        query?: string;
        [key: string]: string | undefined;
    };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
    const query = searchParams.query || "";

    return (
        <div className="p-6">
            <h1 className="text-xl font-semibold mb-4">
                Search results for: {query}
            </h1>
        </div>
    );
}