import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteLinkButton } from "./invite-link-button";
import { MembersSection } from "./members-section";
import { LeaveListButton } from "./leave-list-button";

type MemberRow = {
  user_id: string;
  role: "admin" | "member";
  profiles: { pseudo: string } | null;
};

export default async function ListeDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, color, members_visible")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const { data: memberData } = await supabase
    .from("list_members")
    .select("user_id, role, profiles(pseudo)")
    .eq("list_id", id)
    .order("joined_at", { ascending: true });

  const members = (memberData ?? []) as unknown as MemberRow[];
  const me = members.find((m) => m.user_id === user.id);
  const isAdmin = me?.role === "admin";
  const admins = members.filter((m) => m.role === "admin");
  // Membres masqués + non-admin : la sécurité ne renvoie que ma propre ligne.
  const membersHidden = !list.members_visible && !isAdmin;

  const { data: invite } = await supabase
    .from("list_invites")
    .select("token")
    .eq("list_id", id)
    .eq("revoked", false)
    .limit(1)
    .maybeSingle();

  const { data: eventLinks } = await supabase
    .from("event_lists")
    .select("events(id, title, event_date, event_time)")
    .eq("list_id", id);
  const listEvents = ((eventLinks ?? []) as unknown as {
    events: {
      id: string;
      title: string;
      event_date: string;
      event_time: string;
    } | null;
  }[])
    .map((el) => el.events)
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) =>
      (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time)
    );

  return (
    <div className="pb-8">
      <Link href="/listes" className="inline-block text-sm font-bold mb-3 text-ink-soft">
        ← Retour
      </Link>

      <div
        className="rounded-2xl p-5 mb-4 text-white"
        style={{ background: list.color }}
      >
        <h1 className="text-2xl font-extrabold font-display">{list.name}</h1>
        <div className="text-sm mt-1 opacity-90">
          {membersHidden
            ? "Membres masqués"
            : `${members.length} membre${members.length > 1 ? "s" : ""} · Admin : ${admins
                .map((a) => a.profiles?.pseudo || "?")
                .join(", ")}`}
        </div>
      </div>

      {invite && <InviteLinkButton token={invite.token} isAdmin={!!isAdmin} listId={list.id} />}

      <MembersSection
        listId={list.id}
        myUserId={user.id}
        isAdmin={!!isAdmin}
        membersHidden={membersHidden}
        members={members.map((m) => ({
          userId: m.user_id,
          pseudo: m.profiles?.pseudo || "(sans pseudo)",
          role: m.role,
        }))}
      />

      <h3 className="font-extrabold mb-2 font-display">Événements de la liste</h3>
      {listEvents.length === 0 && (
        <p className="text-sm text-ink-soft mb-6">
          Aucun événement pour l&apos;instant.
        </p>
      )}
      <div className="mb-6">
        {listEvents.map((ev) => (
          <Link
            key={ev.id}
            href={`/evenements/${ev.id}`}
            className="rounded-xl px-4 py-3 mb-2 flex justify-between items-center bg-card border-[1.5px] border-line"
          >
            <span className="font-semibold text-sm">{ev.title}</span>
            <span className="text-xs font-bold text-ink-soft">
              {new Date(ev.event_date + "T00:00").toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}{" "}
              · {ev.event_time.slice(0, 5)}
            </span>
          </Link>
        ))}
      </div>

      <LeaveListButton listId={list.id} lastMember={members.length === 1} />
    </div>
  );
}
