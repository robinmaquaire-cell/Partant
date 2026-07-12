import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RelTime } from "@/components/rel-time";
import { RsvpBar } from "./rsvp-bar";
import { EquipmentSection } from "./equipment-section";
import { OwnerActions } from "./owner-actions";

type EventRow = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  max_participants: number;
  collaborative: boolean;
  created_by: string;
  event_lists: { lists: { id: string; name: string; color: string } | null }[];
  rsvps: { user_id: string; status: "yes" | "no" }[];
  equipment_items: {
    id: string;
    name: string;
    kind: "indiv" | "collectif";
    qty: number | null;
    added_by: string | null;
    equipment_contributions: { user_id: string; qty: number }[];
    equipment_confirmations: { user_id: string }[];
  }[];
};

export default async function EvenementDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data } = await supabase
    .from("events")
    .select(
      `id, title, description, event_date, event_time, location_text, lat, lng,
       max_participants, collaborative, created_by,
       event_lists(lists(id, name, color)),
       rsvps(user_id, status),
       equipment_items(id, name, kind, qty, added_by,
         equipment_contributions(user_id, qty),
         equipment_confirmations(user_id))`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const ev = data as unknown as EventRow;

  // Tous les pseudos utiles en une seule requête.
  const userIds = new Set<string>([ev.created_by]);
  ev.rsvps.forEach((r) => userIds.add(r.user_id));
  ev.equipment_items.forEach((it) => {
    if (it.added_by) userIds.add(it.added_by);
    it.equipment_contributions.forEach((c) => userIds.add(c.user_id));
    it.equipment_confirmations.forEach((c) => userIds.add(c.user_id));
  });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, pseudo")
    .in("id", [...userIds]);
  const pseudoOf = new Map(
    (profiles ?? []).map((p) => [p.id, p.pseudo || "(sans pseudo)"])
  );
  const nameOf = (uid: string) =>
    uid === user.id ? "toi" : pseudoOf.get(uid) || "?";

  const lists = ev.event_lists
    .map((el) => el.lists)
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const color = lists[0]?.color || "#2C7DA0";
  const yesList = ev.rsvps.filter((r) => r.status === "yes");
  const myStatus = ev.rsvps.find((r) => r.user_id === user.id)?.status ?? null;
  const isCreator = ev.created_by === user.id;

  const longDate = new Date(ev.event_date + "T00:00").toLocaleDateString(
    "fr-FR",
    { weekday: "long", day: "numeric", month: "long" }
  );

  const indivItems = ev.equipment_items
    .filter((it) => it.kind === "indiv")
    .map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty ?? 1,
      iHave: it.equipment_confirmations.some((c) => c.user_id === user.id),
      confirmedNames: it.equipment_confirmations.map((c) => nameOf(c.user_id)),
    }));

  const collItems = ev.equipment_items
    .filter((it) => it.kind === "collectif")
    .map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty ?? 1,
      isMine: it.added_by === user.id,
      addedByName: it.added_by ? nameOf(it.added_by) : null,
      myQty:
        it.equipment_contributions.find((c) => c.user_id === user.id)?.qty ?? 0,
      othersQty: it.equipment_contributions
        .filter((c) => c.user_id !== user.id)
        .reduce((a, c) => a + c.qty, 0),
      detail: it.equipment_contributions
        .map((c) => `${c.qty} par ${nameOf(c.user_id)}`)
        .join(", "),
    }));

  return (
    <div className="pb-40">
      <Link href="/" className="inline-block text-sm font-bold mb-3 text-ink-soft">
        ← Retour
      </Link>

      <div className="rounded-2xl p-5 mb-4 text-white" style={{ background: color }}>
        <h1 className="text-2xl font-extrabold leading-tight font-display">
          {ev.title}
        </h1>
        <div className="mt-3 text-sm font-semibold opacity-95">
          🗓 {longDate} à {ev.event_time.slice(0, 5)} ·{" "}
          <RelTime date={ev.event_date} />
        </div>
        {(ev.location_text || ev.lat !== null) && (
          <div className="text-sm font-semibold opacity-95">
            📍 {ev.location_text}
            {ev.lat !== null && ev.lng !== null && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${ev.lat}&mlon=${ev.lng}#map=15/${ev.lat}/${ev.lng}`}
                target="_blank"
                rel="noreferrer"
                className="underline ml-2 font-bold"
              >
                Voir sur la carte ↗
              </a>
            )}
          </div>
        )}
        <div className="mt-2 flex gap-2 flex-wrap">
          {lists.map((l) => (
            <span
              key={l.id}
              className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20"
            >
              {l.name}
            </span>
          ))}
        </div>
      </div>

      {isCreator && <OwnerActions eventId={ev.id} />}

      {ev.description && (
        <p className="mb-5 text-[15px] leading-relaxed whitespace-pre-line">
          {ev.description}
        </p>
      )}

      <h3 className="font-extrabold mb-2 font-display">
        Partants — {yesList.length}/{ev.max_participants}
      </h3>
      <div className="flex flex-wrap gap-2 mb-6">
        {yesList.map((r) => (
          <span
            key={r.user_id}
            className="px-3 py-1 rounded-full text-sm font-semibold bg-card border-[1.5px] border-line"
          >
            {r.user_id === user.id ? "Toi" : pseudoOf.get(r.user_id) || "?"}
          </span>
        ))}
        {yesList.length === 0 && (
          <span className="text-sm text-ink-soft">
            Personne pour l&apos;instant — sois le·la premier·ère !
          </span>
        )}
      </div>

      <EquipmentSection
        eventId={ev.id}
        collaborative={ev.collaborative}
        indivItems={indivItems}
        collItems={collItems}
      />

      <RsvpBar
        eventId={ev.id}
        myStatus={myStatus}
        full={yesList.length >= ev.max_participants && myStatus !== "yes"}
      />
    </div>
  );
}
