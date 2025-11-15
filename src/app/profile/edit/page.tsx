import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import ProfileEditClient from "./profile-edit-client";

export default async function EditProfilePage() {
    const supabase = await supabaseServer();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    return <ProfileEditClient userId={user.id} />;
}