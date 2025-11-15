"use client";

import dynamic from "next/dynamic";

type Props = {
    /** Whose profile to display. If omitted, show the viewer's own profile. */
    userId?: string;
};

const ProfileViewClient = dynamic<{ userId?: string }>(
    () => import("./ProfileViewClient"),
    { ssr: false }
);

export default function ProfileClientWrapper({ userId }: Props) {
    return <ProfileViewClient userId={userId} />;
}