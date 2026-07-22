import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventCardData } from "@/components/event-card";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  location_text: string;
  max_participants: number;
  category: string | null;
  event_lists: {
    lists: {
      id: string;
      name: string;
      color: string;
      emoji: string | null;
      logo_url: string | null;
    } | null;
  }[];
  rsvps: { user_id: string; status: "yes" | "no" }[];
};

// Tous les événements qui m'arrivent (par mes listes, par un lien
// d'invitation, ou parce que je les organise) — la sécurité Supabase
// se charge du filtrage. Sert à l'accueil comme à la page calendrier.
export async function fetchMyEvents(
  supabase: SupabaseClient,
  userId: string
): Promise<EventCardData[]> {
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, event_date, event_time, location_text, max_participants, category, event_lists(lists(id, name, color, emoji, logo_url)), rsvps(user_id, status)"
    )
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  const events = (data ?? []) as unknown as EventRow[];

  return events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    event_date: ev.event_date,
    event_time: ev.event_time,
    location_text: ev.location_text,
    max_participants: ev.max_participants,
    category: ev.category,
    lists: ev.event_lists
      .map((el) => el.lists)
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        emoji: l.emoji,
        logoUrl: l.logo_url,
      })),
    yesCount: ev.rsvps.filter((r) => r.status === "yes").length,
    myStatus: ev.rsvps.find((r) => r.user_id === userId)?.status ?? null,
  }));
}
