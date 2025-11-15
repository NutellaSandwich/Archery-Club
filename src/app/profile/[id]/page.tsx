// app/profile/[id]/page.tsx
import ProfileClientWrapper from "../ProfileClientWrapper";

export default async function ProfileByIdPage(
    props: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
    // `params` can be a plain object (Next 14) or a Promise (Next 15) — handle both.
    const { params } = props as { params: any };
    const { id } = await Promise.resolve(params);

    return <ProfileClientWrapper userId={id} />;
}