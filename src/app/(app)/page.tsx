import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EventCardData } from "@/components/event-card";
import { EventsView } from "@/components/events-view";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  location_text: string;
  max_participants: number;
  event_lists: { lists: { id: string; name: string; color: string } | null }[];
  rsvps: { user_id: string; status: "yes" | "no" }[];
};

export default async function EvenementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Tous les événements visibles : la vue liste filtre sur « à venir »,
  // le calendrier permet aussi de revoir les mois passés.
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, event_date, event_time, location_text, max_participants, event_lists(lists(id, name, color)), rsvps(user_id, status)"
    )
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  const events = (data ?? []) as unknown as EventRow[];

  const cards: EventCardData[] = events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    event_date: ev.event_date,
    event_time: ev.event_time,
    location_text: ev.location_text,
    max_participants: ev.max_participants,
    lists: ev.event_lists
      .map((el) => el.lists)
      .filter((l): l is NonNullable<typeof l> => l !== null),
    yesCount: ev.rsvps.filter((r) => r.status === "yes").length,
    myStatus: ev.rsvps.find((r) => r.user_id === user.id)?.status ?? null,
  }));

  return <EventsView events={cards} />;
}
