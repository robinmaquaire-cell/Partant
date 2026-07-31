import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListLogo } from "@/components/list-logo";
import { LeaveSubscriptionButton } from "./leave-subscription-button";

type BroadcastListRow = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  visibility: "private" | "public";
  member_count: number;
};

type SubscriptionRow = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  owner_pseudo: string | null;
};

export default async function ListesDiffusionPage() {
  const supabase = await createClient();
  const [{ data: mine }, { data: subs }] = await Promise.all([
    supabase.rpc("my_broadcast_lists"),
    supabase.rpc("my_broadcast_subscriptions"),
  ]);
  const lists = (mine ?? []) as BroadcastListRow[];
  const subscriptions = (subs ?? []) as SubscriptionRow[];

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

      <div className="text-xs font-bold uppercase tracking-wide mb-2 text-ink-soft">
        Mes listes
      </div>
      {lists.length === 0 && (
        <div className="text-center py-6 text-ink-soft">
          Aucune liste pour l&apos;instant. Crée la première !
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
            <div className="font-bold flex items-center gap-1.5">
              {l.name}
              {l.visibility === "public" && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-river/15 text-river">
                  🌍 publique
                </span>
              )}
            </div>
            <div className="text-sm text-ink-soft">
              {l.member_count} contact{l.member_count > 1 ? "s" : ""}
            </div>
          </div>
          <span className="text-ink-soft">›</span>
        </Link>
      ))}

      {subscriptions.length > 0 && (
        <>
          <div className="text-xs font-bold uppercase tracking-wide mt-6 mb-2 text-ink-soft">
            Listes que je suis
          </div>
          {subscriptions.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl p-4 mb-3 bg-card border-[1.5px] border-line"
            >
              <div className="flex items-center gap-3">
                <ListLogo
                  list={{
                    name: s.name,
                    color: s.color,
                    emoji: s.emoji,
                    logoUrl: null,
                  }}
                  size={40}
                />
                <div className="flex-1">
                  <div className="font-bold">{s.name}</div>
                  <div className="text-sm text-ink-soft">
                    Par {s.owner_pseudo ?? "quelqu'un"}
                  </div>
                </div>
              </div>
              <LeaveSubscriptionButton id={s.id} name={s.name} />
            </div>
          ))}
        </>
      )}

      <p className="text-xs mt-4 text-center text-ink-soft">
        Tes listes privées sont invisibles pour les autres. Les listes publiques
        se rejoignent via leur lien.
      </p>
    </div>
  );
}
