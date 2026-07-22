import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RelTime } from "@/components/rel-time";
import { Avatar } from "@/components/avatar";
import { RsvpBar } from "./rsvp-bar";
import { EquipmentSection } from "./equipment-section";
import { OwnerActions } from "./owner-actions";
import { OrganizersSection } from "./organizers-section";
import { RolesSection } from "./roles-section";
import { ShareSection } from "./share-section";
import { ShareButton } from "./share-button";
import { ChatSection, type ChatMessage } from "./chat-section";

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
  category: string | null;
  created_by: string;
  event_lists: { lists: { id: string; name: string; color: string } | null }[];
  event_organizers: { user_id: string }[];
  rsvps: { user_id: string; status: "yes" | "no" }[];
  equipment_items: {
    id: string;
    name: string;
    kind: "indiv" | "collectif";
    qty: number | null;
    category: string | null;
    added_by: string | null;
    equipment_contributions: { user_id: string; qty: number }[];
    equipment_confirmations: { user_id: string }[];
  }[];
  event_roles: {
    id: string;
    name: string;
    capacity: number;
    created_at: string;
    event_role_takers: { user_id: string }[];
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
       max_participants, collaborative, category, created_by,
       event_lists(lists(id, name, color)),
       event_organizers(user_id),
       rsvps(user_id, status),
       equipment_items(id, name, kind, qty, category, added_by,
         equipment_contributions(user_id, qty),
         equipment_confirmations(user_id)),
       event_roles(id, name, capacity, created_at, event_role_takers(user_id))`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const ev = data as unknown as EventRow;

  // La discussion de l'événement, du plus ancien au plus récent.
  const { data: messageRows } = await supabase
    .from("event_messages")
    .select("id, user_id, body, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true })
    .limit(300);
  const messages = (messageRows ?? []) as {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
  }[];

  // Tous les pseudos et photos utiles en une seule requête.
  const userIds = new Set<string>([ev.created_by]);
  messages.forEach((m) => userIds.add(m.user_id));
  ev.rsvps.forEach((r) => userIds.add(r.user_id));
  ev.event_organizers.forEach((o) => userIds.add(o.user_id));
  ev.equipment_items.forEach((it) => {
    if (it.added_by) userIds.add(it.added_by);
    it.equipment_contributions.forEach((c) => userIds.add(c.user_id));
    it.equipment_confirmations.forEach((c) => userIds.add(c.user_id));
  });
  (ev.event_roles ?? []).forEach((r) =>
    r.event_role_takers.forEach((t) => userIds.add(t.user_id))
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, pseudo, avatar_url")
    .in("id", [...userIds]);
  const profileOf = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { pseudo: p.pseudo || "(sans pseudo)", avatarUrl: p.avatar_url ?? null },
    ])
  );
  const pseudoOf = new Map(
    [...profileOf].map(([id, p]) => [id, p.pseudo])
  );
  const nameOf = (uid: string) =>
    uid === user.id ? "toi" : pseudoOf.get(uid) || "?";
  const personOf = (uid: string) => ({
    userId: uid,
    pseudo: pseudoOf.get(uid) || "?",
    avatarUrl: profileOf.get(uid)?.avatarUrl ?? null,
  });

  const lists = ev.event_lists
    .map((el) => el.lists)
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const color = lists[0]?.color || "#2C7DA0";
  const organizerIds = new Set(ev.event_organizers.map((o) => o.user_id));
  const yesList = ev.rsvps.filter((r) => r.status === "yes");
  const partants = yesList.filter((r) => !organizerIds.has(r.user_id));
  const myStatus = ev.rsvps.find((r) => r.user_id === user.id)?.status ?? null;
  const isOrganizer = organizerIds.has(user.id);

  // Le lien de partage : les organisateurs le créent à la première ouverture,
  // les autres partagent celui qui existe déjà.
  let shareToken: string | null = null;
  if (isOrganizer) {
    const { data: token } = await supabase.rpc("get_event_share_token", {
      p_event: ev.id,
    });
    shareToken = (token as string) ?? null;
  } else {
    const { data: invite } = await supabase
      .from("event_invites")
      .select("token")
      .eq("event_id", ev.id)
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    shareToken = invite?.token ?? null;
  }

  // Les personnes arrivées par le lien de partage, membres d'aucune des
  // listes de l'événement. (Sans liste, tout le monde est dans ce cas :
  // on l'indique une seule fois en haut plutôt que sur chaque personne.)
  const outsiders = new Set<string>();
  if (lists.length > 0) {
    const { data: rows } = await supabase.rpc("event_outsiders", {
      p_event: ev.id,
    });
    ((rows ?? []) as { user_id: string }[]).forEach((r) =>
      outsiders.add(r.user_id)
    );
  }

  const longDate = new Date(ev.event_date + "T00:00").toLocaleDateString(
    "fr-FR",
    { weekday: "long", day: "numeric", month: "long" }
  );

  // Les rôles, dans l'ordre où ils ont été créés.
  const roles = [...(ev.event_roles ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      takers: r.event_role_takers.map((t) => personOf(t.user_id)),
      mine: r.event_role_takers.some((t) => t.user_id === user.id),
    }));

  const chatMessages: ChatMessage[] = messages.map((m) => {
    const p = personOf(m.user_id);
    return {
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      pseudo: p.pseudo,
      avatarUrl: p.avatarUrl,
      isMine: m.user_id === user.id,
      canDelete: m.user_id === user.id || isOrganizer,
    };
  });

  const indivItems = ev.equipment_items
    .filter((it) => it.kind === "indiv")
    .map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty ?? 1,
      category: it.category,
      iHave: it.equipment_confirmations.some((c) => c.user_id === user.id),
      confirmedNames: it.equipment_confirmations.map((c) => nameOf(c.user_id)),
    }));

  const collItems = ev.equipment_items
    .filter((it) => it.kind === "collectif")
    .map((it) => ({
      id: it.id,
      name: it.name,
      qty: it.qty ?? 1,
      category: it.category,
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
      <div className="flex items-center justify-between mb-3">
        <Link href="/" className="text-sm font-bold text-ink-soft">
          ← Retour
        </Link>
        <ShareButton
          path={shareToken ? `/e/${shareToken}` : "/"}
          title={ev.title}
          withInvite={shareToken !== null}
        />
      </div>

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
          {ev.category && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
              🏷 {ev.category}
            </span>
          )}
          {lists.map((l) => (
            <span
              key={l.id}
              className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20"
            >
              {l.name}
            </span>
          ))}
          {lists.length === 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
              🔗 Sur invitation — aucune liste de diffusion
            </span>
          )}
        </div>
      </div>

      {isOrganizer && <OwnerActions eventId={ev.id} />}

      {isOrganizer && <ShareSection eventId={ev.id} />}

      {ev.description && (
        <p className="mb-5 text-[15px] leading-relaxed whitespace-pre-line">
          {ev.description}
        </p>
      )}

      <OrganizersSection
        eventId={ev.id}
        isOrganizer={isOrganizer}
        organizers={ev.event_organizers.map((o) => personOf(o.user_id))}
        candidates={partants.map((r) => personOf(r.user_id))}
      />

      <RolesSection
        eventId={ev.id}
        isOrganizer={isOrganizer}
        canTake={myStatus === "yes" || isOrganizer}
        roles={roles}
      />

      <h3 className="font-extrabold mb-2 font-display">
        Partants — {yesList.length}/{ev.max_participants}
      </h3>
      <div className="flex flex-wrap gap-2 mb-6">
        {partants.map((r) => {
          const p = personOf(r.user_id);
          return (
            <span
              key={r.user_id}
              className="pl-1 pr-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 bg-card border-[1.5px] border-line"
            >
              <Avatar pseudo={p.pseudo} url={p.avatarUrl} size={24} />
              {r.user_id === user.id ? "Toi" : p.pseudo}
              {outsiders.has(r.user_id) && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sand text-pine"
                  title="Cette personne n'est dans aucune liste de diffusion de l'événement"
                >
                  hors liste
                </span>
              )}
            </span>
          );
        })}
        {partants.length === 0 && (
          <span className="text-sm text-ink-soft">
            {yesList.length > 0
              ? "Les organisateurs sont prêts — à qui le tour ?"
              : "Personne pour l'instant — sois le·la premier·ère !"}
          </span>
        )}
      </div>

      <EquipmentSection
        eventId={ev.id}
        collaborative={ev.collaborative}
        indivItems={indivItems}
        collItems={collItems}
      />

      <ChatSection eventId={ev.id} messages={chatMessages} />

      <RsvpBar
        eventId={ev.id}
        myStatus={myStatus}
        full={yesList.length >= ev.max_participants && myStatus !== "yes"}
        organizer={isOrganizer}
      />
    </div>
  );
}
