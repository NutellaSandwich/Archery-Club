"use client";

import dynamic from "next/dynamic";

// ✅ This is a small client bridge that dynamically loads your ClubFeedClient safely
const ClubFeedClient = dynamic(() => import("./club-feed-client"), {
    ssr: false,
});

export default function ClubFeedWrapper({
    userId,
    clubId,
}: {
    userId: string;
    clubId: string | null;
}) {
    return <ClubFeedClient userId={userId} clubId={clubId} />;
}