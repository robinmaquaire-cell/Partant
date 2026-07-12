import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { TemplatesSection } from "./templates-section";

type TemplateRow = {
  id: string;
  name: string;
  payload: { event_time?: string; location_text?: string } | null;
};

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [{ data: profile }, { data: templates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, contact_mode, contact")
      .eq("id", user.id)
      .single(),
    supabase
      .from("templates")
      .select("id, name, payload")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <>
      <ProfileForm
        initial={{
          pseudo: profile?.pseudo ?? "",
          contactMode: profile?.contact_mode ?? "email",
          contact: profile?.contact ?? user.email ?? "",
        }}
      />
      <TemplatesSection
        templates={((templates ?? []) as TemplateRow[]).map((t) => ({
          id: t.id,
          name: t.name,
          time: t.payload?.event_time?.slice(0, 5) ?? "",
          location: t.payload?.location_text ?? "",
        }))}
      />
    </>
  );
}
