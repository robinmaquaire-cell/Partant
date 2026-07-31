import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchMyEvents } from "@/lib/my-events";
import { MyCalendar } from "./my-calendar";
import { ShareCard } from "./share-card";
import { SyncRules, type CalendarList } from "./sync-rules";
import { EventSyncList, type SyncEvent } from "./event-sync-list";
import { MyAvailability, type AvailSlot } from "./my-availability";

type CalendarRow = {
  event_id: string;
  from_list: boolean;
  from_link: boolean;
  my_status: "yes" | "no" | null;
  rule_ok: boolean;
  override_included: boolean | null;
  synced: boolean;
};

type MembershipRow = {
  in_calendar: boolean;
  lists: {
    id: string;
    name: string;
    color: string;
    emoji: string | null;
    logo_url: string | null;
  } | null;
};

export default async function CalendrierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Fenêtre pour la vue « Ma disponibilité » : ~3 mois autour d'aujourd'hui
  // (assez pour naviguer un peu avant/après sans nouvelle requête).
  const availFrom = new Date();
  availFrom.setUTCMonth(availFrom.getUTCMonth() - 1);
  availFrom.setUTCDate(1);
  availFrom.setUTCHours(0, 0, 0, 0);
  const availTo = new Date();
  availTo.setUTCMonth(availTo.getUTCMonth() + 2);
  availTo.setUTCDate(1);
  availTo.setUTCHours(0, 0, 0, 0);

  const [
    events,
    { data: rows },
    { data: prefs },
    { data: memberships },
    { data: token },
    { data: availRows },
  ] = await Promise.all([
    fetchMyEvents(supabase, user.id),
    supabase.rpc("my_calendar_rows"),
    supabase
      .from("calendar_prefs")
      .select("only_yes, include_guest_events, date_from, date_to, categories")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("list_members")
      .select("in_calendar, lists(id, name, color, emoji, logo_url)")
      .eq("user_id", user.id),
    // Crée le lien de calendrier à la première visite.
    supabase.rpc("get_calendar_token"),
    supabase.rpc("my_availability_slots", {
      p_from: availFrom.toISOString(),
      p_to: availTo.toISOString(),
    }),
  ]);

  const initialAvail: AvailSlot[] = (
    (availRows ?? []) as {
      source: "ics" | "partant" | "manual";
      slot_id: string | null;
      starts_at: string;
      ends_at: string;
      label: string | null;
    }[]
  ).map((r) => ({
    source: r.source,
    slotId: r.slot_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    label: r.label,
  }));

  const syncOf = new Map(
    ((rows ?? []) as CalendarRow[]).map((r) => [r.event_id, r])
  );

  // L'adresse publique du site, telle que le navigateur l'a demandée.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const calendarUrl = token
    ? `${proto}://${host}/api/calendrier/${token}.ics`
    : "";

  const lists: CalendarList[] = ((memberships ?? []) as unknown as MembershipRow[])
    .filter((m) => m.lists !== null)
    .map((m) => ({
      id: m.lists!.id,
      name: m.lists!.name,
      color: m.lists!.color,
      emoji: m.lists!.emoji,
      logoUrl: m.lists!.logo_url,
      inCalendar: m.in_calendar,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const categories = [
    ...new Set(
      events.flatMap((e) => e.tags).map((t) => t.trim()).filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  // Le calendrier « Partant ? » : tout ce que je reçois, sauf mes refus.
  const mine = events.filter((e) => e.myStatus !== "no");

  const todayKey = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());

  const upcoming: SyncEvent[] = events
    .filter((e) => e.event_date >= todayKey)
    .map((e) => {
      const row = syncOf.get(e.id);
      return {
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: e.event_time,
        listNames: e.lists.map((l) => l.name).join(", "),
        tags: e.tags,
        myStatus: e.myStatus,
        synced: row?.synced ?? false,
        ruleOk: row?.rule_ok ?? false,
        isException: row?.override_included != null,
      };
    });

  const syncedCount = upcoming.filter((e) => e.synced).length;

  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-1 font-display">
        Ma disponibilité
      </h2>
      <p className="text-sm mb-4 text-ink-soft">
        Ton agenda perso, tes événements Partants ? où tu as dit « oui », et
        les créneaux que tu ajoutes ici — regroupés en un seul calendrier.
      </p>

      <MyAvailability initialSlots={initialAvail} />

      <h2 className="text-xl font-extrabold mt-8 mb-1 font-display">
        Mon calendrier
      </h2>
      <p className="text-sm mb-4 text-ink-soft">
        Tout ce qui t&apos;arrive sur Partants ?, en calendrier ou sur la carte.
      </p>

      <MyCalendar events={mine} />

      <h2 className="text-xl font-extrabold mt-8 mb-1 font-display">
        Calendrier synchronisé
      </h2>
      <p className="text-sm mb-3 text-ink-soft">
        {syncedCount} événement{syncedCount > 1 ? "s" : ""} à venir part
        {syncedCount > 1 ? "ent" : ""} dans ton agenda externe.
      </p>

      {calendarUrl && <ShareCard url={calendarUrl} />}

      <SyncRules
        lists={lists}
        categories={categories}
        initial={{
          onlyYes: prefs?.only_yes ?? false,
          includeGuestEvents: prefs?.include_guest_events ?? true,
          dateFrom: prefs?.date_from ?? null,
          dateTo: prefs?.date_to ?? null,
          categories: (prefs?.categories as string[] | null) ?? null,
        }}
      />

      <EventSyncList events={upcoming} />
    </div>
  );
}
