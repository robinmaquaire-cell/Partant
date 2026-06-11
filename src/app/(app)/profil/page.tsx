import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, contact_mode, contact")
    .eq("id", user.id)
    .single();

  return (
    <ProfileForm
      initial={{
        pseudo: profile?.pseudo ?? "",
        contactMode: profile?.contact_mode ?? "email",
        contact: profile?.contact ?? user.email ?? "",
      }}
    />
  );
}
