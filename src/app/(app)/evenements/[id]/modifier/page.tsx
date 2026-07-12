import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../../event-form";

type EquipmentRow = {
  id: string;
  name: string;
  kind: "indiv" | "collectif";
  qty: number | null;
  added_by: string | null;
};

export default async function ModifierEvenementPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: ev } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, event_time, location_text, lat, lng, max_participants, collaborative, created_by, event_lists(list_id), event_organizers(user_id), equipment_items(id, name, kind, qty, added_by)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!ev) notFound();
  // Seuls les organisateurs peuvent modifier : les autres retournent au détail.
  const isOrganizer = (ev.event_organizers ?? []).some(
    (o: { user_id: string }) => o.user_id === user.id
  );
  if (!isOrganizer) redirect(`/evenements/${id}`);

  const { data: lists } = await supabase.rpc("my_lists");
  const equipment = (ev.equipment_items ?? []) as EquipmentRow[];

  return (
    <EventForm
      lists={(lists ?? []).map(
        (l: { id: string; name: string; color: string }) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        })
      )}
      edit={{
        eventId: ev.id,
        initial: {
          title: ev.title,
          description: ev.description,
          date: ev.event_date,
          time: ev.event_time.slice(0, 5),
          location: ev.location_text,
          lat: ev.lat,
          lng: ev.lng,
          max: ev.max_participants,
          collaborative: ev.collaborative,
          listIds: (ev.event_lists ?? []).map(
            (el: { list_id: string }) => el.list_id
          ),
        },
        // Seul le matériel posé par l'organisateur se gère ici ; ce que les
        // participants ont ajouté leur appartient (mode collaboratif).
        existingEquipment: equipment
          .filter((it) => it.added_by === null)
          .map((it) => ({
            id: it.id,
            name: it.name,
            kind: it.kind,
            qty: it.qty,
          })),
      }}
    />
  );
}
