import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListLogo } from "@/components/list-logo";

type BroadcastListRow = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  member_count: number;
};

export default async function ListesDiffusionPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_broadcast_lists");
  const lists = (data ?? []) as BroadcastListRow[];

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold font-display">
          Listes de diffusion
        </h2>
        <Link
          href="/contacts/listes/nouvelle"
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          + Liste
        </Link>
      </div>

      <p className="text-sm mb-4 text-ink-soft">
        Regroupe des contacts pour leur diffuser des événements sans partager la
        liste elle-même. Chacun reçoit l&apos;invitation à titre personnel.
      </p>

      {lists.length === 0 && (
        <div className="text-center py-10 text-ink-soft">
          Aucune liste de diffusion pour l&apos;instant. Crée la première !
        </div>
      )}

      {lists.map((l) => (
        <Link
          key={l.id}
          href={`/contacts/listes/${l.id}`}
          className="rounded-2xl p-4 mb-3 flex items-center gap-3 bg-card border-[1.5px] border-line"
        >
          <ListLogo
            list={{
              name: l.name,
              color: l.color,
              emoji: l.emoji,
              logoUrl: null,
            }}
            size={40}
          />
          <div className="flex-1">
            <div className="font-bold">{l.name}</div>
            <div className="text-sm text-ink-soft">
              {l.member_count} contact{l.member_count > 1 ? "s" : ""}
            </div>
          </div>
          <span className="text-ink-soft">›</span>
        </Link>
      ))}

      <p className="text-xs mt-4 text-center text-ink-soft">
        Tes listes de diffusion sont privées : personne d&apos;autre que toi ne
        les voit.
      </p>
    </div>
  );
}
