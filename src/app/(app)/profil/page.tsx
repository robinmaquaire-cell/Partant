import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { TemplatesSection } from "./templates-section";
import { AvatarUpload } from "./avatar-upload";
import { PasswordSection } from "./password-section";
import { DeleteAccount } from "./delete-account";
import Link from "next/link";

type TemplateRow = {
  id: string;
  name: string;
  payload: { event_time?: string; location_text?: string } | null;
};

export default async function ProfilPage(props: {
  searchParams: Promise<{ bienvenue?: string; mdp?: string }>;
}) {
  const { bienvenue, mdp } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [{ data: profile }, { data: templates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, contact, avatar_url, email_notifications")
      .eq("id", user.id)
      .single(),
    supabase
      .from("templates")
      .select("id, name, payload")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <>
      {bienvenue && !profile?.pseudo?.trim() && (
        <div className="rounded-2xl p-4 mb-4 bg-signal/10 border-[1.5px] border-signal/40">
          <div className="font-bold text-sm">👋 Bienvenue !</div>
          <p className="text-sm text-ink-soft">
            Choisis ton pseudo pour commencer — c&apos;est lui que tes amis
            verront sur les événements.
          </p>
        </div>
      )}
      <AvatarUpload
        userId={user.id}
        pseudo={profile?.pseudo ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <ProfileForm
        initial={{
          pseudo: profile?.pseudo ?? "",
          contact: profile?.contact ?? user.email ?? "",
          emailNotifications: profile?.email_notifications ?? true,
        }}
      />
      <PasswordSection highlight={mdp === "1"} />
      <TemplatesSection
        templates={((templates ?? []) as TemplateRow[]).map((t) => ({
          id: t.id,
          name: t.name,
          time: t.payload?.event_time?.slice(0, 5) ?? "",
          location: t.payload?.location_text ?? "",
        }))}
      />
      <DeleteAccount />
      <p className="text-xs text-center mt-6 mb-2 text-ink-soft">
        <Link href="/conditions" className="underline">
          Conditions d&apos;utilisation et confidentialité
        </Link>
      </p>
    </>
  );
}
