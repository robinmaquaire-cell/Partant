import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { TemplatesSection } from "./templates-section";
import { AvatarUpload } from "./avatar-upload";
import { CalendarSection } from "./calendar-section";
import { DeleteAccount } from "./delete-account";
import Link from "next/link";

type TemplateRow = {
  id: string;
  name: string;
  payload: { event_time?: string; location_text?: string } | null;
};

type MembershipRow = {
  in_calendar: boolean;
  lists: { id: string; name: string; color: string } | null;
};

export default async function ProfilPage(props: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [
    { data: profile },
    { data: templates },
    { data: calendarToken },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, contact_mode, contact, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("templates")
      .select("id, name, payload")
      .order("created_at", { ascending: true }),
    // Crée le lien de calendrier à la première visite.
    supabase.rpc("get_calendar_token"),
    supabase
      .from("list_members")
      .select("in_calendar, lists(id, name, color)")
      .eq("user_id", user.id),
  ]);

  // L'adresse publique du site, telle que le navigateur l'a demandée.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const calendarUrl = calendarToken
    ? `${proto}://${host}/api/calendrier/${calendarToken}.ics`
    : "";

  const calendarLists = ((memberships ?? []) as unknown as MembershipRow[])
    .filter((m) => m.lists !== null)
    .map((m) => ({
      id: m.lists!.id,
      name: m.lists!.name,
      color: m.lists!.color,
      inCalendar: m.in_calendar,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

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
          contactMode: profile?.contact_mode ?? "email",
          contact: profile?.contact ?? user.email ?? "",
        }}
      />
      {calendarUrl && (
        <CalendarSection url={calendarUrl} lists={calendarLists} />
      )}
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
