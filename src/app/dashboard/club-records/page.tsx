// file: /dashboard/club-records/page.tsx
import { Suspense } from "react";
import ClubRecordsPage from "./club-records-client";

export default function ClubRecordsPageWrapper() {
    return (
        <Suspense fallback={<div className="text-center p-10">Loading club records...</div>}>
            <ClubRecordsPage />
        </Suspense>
    );
}