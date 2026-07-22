import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListLogo } from "@/components/list-logo";

type ListRow = {
  id: string;
  name: string;
  color: string;
  members_visible: boolean;
  emoji: string | null;
  logo_url: string | null;
  role: "admin" | "member";
  member_count: number;
};

export default async function ListesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_lists");
  const lists = (data ?? []) as ListRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold font-display">Mes listes</h2>
        <Link
          href="/listes/nouvelle"
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          + Liste
        </Link>
      </div>

      {lists.length === 0 && (
        <div className="text-center py-12 text-ink-soft">
          Aucune liste pour l&apos;instant. Crée la première !
        </div>
      )}

      {lists.map((l) => (
        <Link
          key={l.id}
          href={`/listes/${l.id}`}
          className="rounded-2xl p-4 mb-3 flex items-center gap-3 bg-card border-[1.5px] border-line"
        >
          <ListLogo
            list={{
              name: l.name,
              color: l.color,
              emoji: l.emoji,
              logoUrl: l.logo_url,
            }}
            size={40}
          />
          <div className="flex-1">
            <div className="font-bold">{l.name}</div>
            <div className="text-sm text-ink-soft">
              {l.member_count} membre{l.member_count > 1 ? "s" : ""}
              {l.role === "admin" && " · Tu es admin"}
            </div>
          </div>
          <span className="text-ink-soft">›</span>
        </Link>
      ))}

      <p className="text-xs mt-4 text-center text-ink-soft">
        Les listes sont privées : on les rejoint uniquement par lien
        d&apos;invitation.
      </p>
    </div>
  );
}
