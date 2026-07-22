import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";
import { JoinSignupForm } from "@/components/join-signup-form";

type InviteInfo = {
  list_id: string;
  list_name: string;
  list_color: string;
  member_count: number;
  already_member: boolean;
};

export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_invite", { p_token: token });
  const invite = (data?.[0] ?? null) as InviteInfo | null;

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-pine">
      <div className="text-4xl font-extrabold mb-2 font-display text-paper">
        Partant<span className="text-signal"> ?</span>
      </div>

      {!invite ? (
        <div className="rounded-2xl p-5 bg-card">
          <div className="font-bold mb-1">😕 Invitation introuvable</div>
          <p className="text-sm text-ink-soft">
            Ce lien d&apos;invitation est invalide ou a été révoqué.
            Demande un nouveau lien à la personne qui te l&apos;a envoyé.
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
            Tu es invité·e à rejoindre la liste
          </p>
          <div
            className="rounded-2xl p-5 mb-4 text-white"
            style={{ background: invite.list_color }}
          >
            <div className="text-2xl font-extrabold font-display">
              {invite.list_name}
            </div>
            <div className="text-sm mt-1 opacity-90">
              {invite.member_count} membre
              {invite.member_count > 1 ? "s" : ""}
            </div>
          </div>

          {user ? (
            invite.already_member ? (
              <div className="rounded-2xl p-5 bg-card">
                <div className="font-bold mb-1">✓ Tu en fais déjà partie !</div>
                <Link
                  href={`/listes/${invite.list_id}`}
                  className="inline-block mt-2 w-full text-center px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
                >
                  Ouvrir la liste
                </Link>
              </div>
            ) : (
              <JoinButton token={token} listName={invite.list_name} />
            )
          ) : (
            <JoinSignupForm label={invite.list_name} next={`/j/${token}`} />
          )}
        </>
      )}
    </div>
  );
}
