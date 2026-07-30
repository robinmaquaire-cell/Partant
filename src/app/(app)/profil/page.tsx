import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { TemplatesSection } from "./templates-section";
import { AvatarUpload } from "./avatar-upload";
import { PasswordSection } from "./password-section";
import { PushSection } from "./push-section";
import { AvailabilitySection } from "./availability-section";
import { DeleteAccount } from "./delete-account";
import { isAdminEmail } from "@/lib/admin";
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

  const now = new Date();
  const nowIso = now.toISOString();
  const in14days = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString();
  const [{ data: profile }, { data: templates }, { data: calSource }, { data: busy }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("pseudo, contact, avatar_url, email_notifications")
        .eq("id", user.id)
        .single(),
      supabase
        .from("templates")
        .select("id, name, payload")
        .order("created_at", { ascending: true }),
      // Peut renvoyer une erreur silencieuse tant que la table n'existe pas
      // (avant l'exécution du SQL 0017) : on retombe alors sur « non relié ».
      supabase
        .from("calendar_sources")
        .select("ics_url, last_synced_at, last_error, busy_share")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("busy_slots")
        .select("starts_at, ends_at")
        .eq("user_id", user.id)
        .gte("ends_at", nowIso)
        .lte("starts_at", in14days)
        .order("starts_at")
        .limit(300),
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
      {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
        <PushSection vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      )}
      <AvailabilitySection
        connected={!!calSource?.ics_url}
        lastSyncedAt={calSource?.last_synced_at ?? null}
        lastError={calSource?.last_error ?? null}
        busyShare={calSource?.busy_share ?? true}
        upcoming={((busy ?? []) as { starts_at: string; ends_at: string }[]).map(
          (b) => ({ start: b.starts_at, end: b.ends_at })
        )}
      />
      <TemplatesSection
        templates={((templates ?? []) as TemplateRow[]).map((t) => ({
          id: t.id,
          name: t.name,
          time: t.payload?.event_time?.slice(0, 5) ?? "",
          location: t.payload?.location_text ?? "",
        }))}
      />
      {isAdminEmail(user.email) && (
        <Link
          href="/admin"
          className="block rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line"
        >
          <div className="font-extrabold font-display">🛠 Retours des utilisateurs</div>
          <p className="text-sm text-ink-soft">
            Lire les avis, vocaux et captures envoyés via le bouton « Mon avis ».
            Réservé à toi.
          </p>
        </Link>
      )}

      <DeleteAccount />
      <p className="text-xs text-center mt-6 mb-2 text-ink-soft">
        <Link href="/conditions" className="underline">
          Conditions d&apos;utilisation et confidentialité
        </Link>
      </p>
    </>
  );
}
