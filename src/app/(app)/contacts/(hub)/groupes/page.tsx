import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListLogo } from "@/components/list-logo";

// Historiquement les groupes s'appellent « lists » dans la base
// (tables lists / list_members / event_lists / list_invites). Côté utilisateur,
// on ne parle plus que de « groupes ». Le RPC my_lists reste donc utilisé.
type GroupRow = {
  id: string;
  name: string;
  color: string;
  members_visible: boolean;
  emoji: string | null;
  logo_url: string | null;
  role: "admin" | "member";
  member_count: number;
};

export default async function GroupesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_lists");
  const groups = (data ?? []) as GroupRow[];

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold font-display">Mes groupes</h2>
        <Link
          href="/listes/nouvelle"
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          + Groupe
        </Link>
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12 text-ink-soft">
          Aucun groupe pour l&apos;instant. Crée le premier !
        </div>
      )}

      {groups.map((g) => (
        <Link
          key={g.id}
          href={`/listes/${g.id}`}
          className="rounded-2xl p-4 mb-3 flex items-center gap-3 bg-card border-[1.5px] border-line"
        >
          <ListLogo
            list={{
              name: g.name,
              color: g.color,
              emoji: g.emoji,
              logoUrl: g.logo_url,
            }}
            size={40}
          />
          <div className="flex-1">
            <div className="font-bold">{g.name}</div>
            <div className="text-sm text-ink-soft">
              {g.member_count} membre{g.member_count > 1 ? "s" : ""}
              {g.role === "admin" && " · Tu es admin"}
            </div>
          </div>
          <span className="text-ink-soft">›</span>
        </Link>
      ))}

      <p className="text-xs mt-4 text-center text-ink-soft">
        Les groupes sont privés : on les rejoint uniquement par lien
        d&apos;invitation.
      </p>
    </div>
  );
}
