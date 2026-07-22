import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../../event-form";
import { listOptionsFrom, type MyListRow } from "../../list-options";

type EquipmentRow = {
  id: string;
  name: string;
  kind: "indiv" | "collectif";
  qty: number | null;
  category: string | null;
  added_by: string | null;
};

type RoleRow = { id: string; name: string; capacity: number };

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
      "id, title, description, event_date, event_time, location_text, lat, lng, max_participants, collaborative, category, created_by, event_lists(list_id), event_organizers(user_id), equipment_items(id, name, kind, qty, category, added_by), event_roles(id, name, capacity)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!ev) notFound();
  // Seuls les organisateurs peuvent modifier : les autres retournent au détail.
  const isOrganizer = (ev.event_organizers ?? []).some(
    (o: { user_id: string }) => o.user_id === user.id
  );
  if (!isOrganizer) redirect(`/evenements/${id}`);

  const [{ data: lists }, { data: cats }] = await Promise.all([
    supabase.rpc("my_lists"),
    supabase.from("events").select("category").not("category", "is", null),
  ]);
  const equipment = (ev.equipment_items ?? []) as EquipmentRow[];

  return (
    <EventForm
      lists={listOptionsFrom((lists ?? []) as MyListRow[])}
      categories={[
        ...new Set(
          ((cats ?? []) as { category: string | null }[])
            .map((c) => (c.category ?? "").trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, "fr"))}
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
          category: ev.category ?? "",
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
            category: it.category,
          })),
        existingRoles: ((ev.event_roles ?? []) as RoleRow[]).map((r) => ({
          id: r.id,
          name: r.name,
          capacity: r.capacity,
        })),
      }}
    />
  );
}
