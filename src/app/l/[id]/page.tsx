import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinSignupForm } from "@/components/join-signup-form";
import { ListLogo } from "@/components/list-logo";
import { JoinBroadcastButton } from "./join-broadcast-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicList = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  owner_id: string;
  owner_pseudo: string | null;
  member_count: number;
  is_member: boolean;
  is_owner: boolean;
};

export default async function ListePubliquePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const validId = UUID_RE.test(id);
  const { data } = validId
    ? await supabase.rpc("get_public_broadcast_list", { p_id: id })
    : { data: null };
  const list = ((data ?? []) as PublicList[])[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-pine">
      <div className="text-4xl font-extrabold mb-2 font-display text-paper">
        Partants<span className="text-signal"> ?</span>
      </div>

      {!list ? (
        <div className="rounded-2xl p-5 bg-card">
          <div className="font-bold mb-1">😕 Liste introuvable</div>
          <p className="text-sm text-ink-soft">
            Ce lien de liste est invalide, ou la liste n&apos;est pas (plus)
            publique.
          </p>
          <Link
            href="/connexion"
            className="inline-block mt-3 text-sm font-bold text-river underline"
          >
            Aller à la page de connexion
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-base text-sand">
            {list.is_member
              ? "Tu es inscrit·e à la liste de diffusion"
              : "Rejoins la liste de diffusion"}
          </p>
          <div
            className="rounded-2xl p-5 mb-4 text-white"
            style={{ background: list.color }}
          >
            <div className="flex items-center gap-3">
              {list.emoji && (
                <ListLogo
                  list={{
                    name: list.name,
                    color: list.color,
                    emoji: list.emoji,
                    logoUrl: null,
                  }}
                  size={48}
                  onColor
                />
              )}
              <div>
                <div className="text-2xl font-extrabold font-display">
                  {list.name}
                </div>
                <div className="text-sm mt-1 opacity-90">
                  Par {list.owner_pseudo ?? "quelqu'un"} · {list.member_count}{" "}
                  membre{list.member_count > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-sand mb-4">
            En rejoignant, tu recevras les événements que{" "}
            {list.owner_pseudo ?? "cette personne"} publie via cette liste. Tu
            peux te retirer à tout moment.
          </p>

          {user ? (
            list.is_owner ? (
              <div className="rounded-2xl p-5 bg-card">
                <div className="font-bold mb-1">
                  📣 C&apos;est ta liste !
                </div>
                <Link
                  href={`/contacts/listes/${list.id}`}
                  className="inline-block mt-2 w-full text-center px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
                >
                  Ouvrir la liste
                </Link>
              </div>
            ) : (
              <JoinBroadcastButton
                listId={list.id}
                listName={list.name}
                isMember={list.is_member}
              />
            )
          ) : (
            <JoinSignupForm label={list.name} next={`/l/${list.id}`} />
          )}
        </>
      )}
    </div>
  );
}
