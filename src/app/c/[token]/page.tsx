import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { JoinSignupForm } from "@/components/join-signup-form";
import { AcceptContactButton } from "./accept-contact-button";

type InviteRow = {
  user_id: string;
  pseudo: string | null;
  avatar_url: string | null;
  is_already_contact: boolean;
  is_me: boolean;
};

export default async function ContactInvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = /^[0-9a-f]{16,64}$/i.test(token)
    ? await supabase.rpc("resolve_contact_invite", { p_token: token })
    : { data: null };
  const invite = ((data ?? []) as InviteRow[])[0] ?? null;
  const pseudo = invite?.pseudo || "quelqu'un";

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-pine">
      <div className="text-4xl font-extrabold mb-2 font-display text-paper">
        Partants<span className="text-signal"> ?</span>
      </div>

      {!invite ? (
        <div className="rounded-2xl p-5 bg-card">
          <div className="font-bold mb-1">😕 Lien introuvable</div>
          <p className="text-sm text-ink-soft">
            Ce lien de contact est invalide ou a été révoqué. Demande un
            nouveau lien à la personne qui te l&apos;a envoyé.
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
            {invite.is_me
              ? "C'est ton propre lien de contact."
              : `${pseudo} t'invite à devenir son contact`}
          </p>
          <div className="rounded-2xl p-5 mb-4 bg-card">
            <div className="flex items-center gap-3">
              <Avatar pseudo={pseudo} url={invite.avatar_url} size={56} />
              <div>
                <div className="text-2xl font-extrabold font-display">
                  {pseudo}
                </div>
                <div className="text-sm mt-0.5 text-ink-soft">
                  Sur Partants ?
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-sand mb-4">
            Devenir contact permet de vous inviter à des événements en un
            geste et de voir votre disponibilité au moment de proposer une
            sortie (jamais le détail de votre agenda).
          </p>

          {user ? (
            invite.is_me ? (
              <div className="rounded-2xl p-5 bg-card">
                <div className="font-bold mb-1">🙂 C&apos;est ton lien</div>
                <p className="text-sm text-ink-soft">
                  Partage-le à des amis pour les ajouter directement à ton
                  carnet.
                </p>
                <Link
                  href="/contacts"
                  className="inline-block mt-3 w-full text-center px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
                >
                  Retour à mes contacts
                </Link>
              </div>
            ) : (
              <AcceptContactButton
                token={token}
                pseudo={pseudo}
                isAlready={invite.is_already_contact}
              />
            )
          ) : (
            <JoinSignupForm label={pseudo} next={`/c/${token}`} />
          )}
        </>
      )}
    </div>
  );
}
