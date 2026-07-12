import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/event-card";

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

  // On affiche les événements d'aujourd'hui et à venir.
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, event_date, event_time, location_text, max_participants, event_lists(lists(id, name, color)), rsvps(user_id, status)"
    )
    .gte("event_date", today)
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

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold font-display">À venir</h2>
        <Link
          href="/evenements/nouveau"
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          + Événement
        </Link>
      </div>

      {cards.length === 0 && (
        <div className="text-center py-12 text-ink-soft">
          Aucun événement à venir. Crée le premier !
        </div>
      )}
      {cards.map((ev) => (
        <EventCard key={ev.id} ev={ev} />
      ))}

      <p className="text-xs mt-4 text-center text-ink-soft">
        🗓 Bientôt : la vue calendrier (jalon 4 du chantier).
      </p>
    </div>
  );
}
