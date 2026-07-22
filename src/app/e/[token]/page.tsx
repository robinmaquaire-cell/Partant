import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinSignupForm } from "@/components/join-signup-form";
import { JoinEventButton } from "./join-event-button";

type EventInvite = {
  event_id: string;
  title: string;
  event_date: string;
  event_time: string;
  location_text: string;
  color: string;
  yes_count: number;
  max_participants: number;
  already_in: boolean;
};

// Page d'arrivée d'un lien de partage d'événement : accessible sans compte.
export default async function PartageEvenementPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_event_invite", { p_token: token });
  const invite = (data?.[0] ?? null) as EventInvite | null;

  const longDate = invite
    ? new Date(invite.event_date + "T00:00").toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-pine">
      <div className="text-4xl font-extrabold mb-2 font-display text-paper">
        Partant<span className="text-signal"> ?</span>
      </div>

      {!invite ? (
        <div className="rounded-2xl p-5 bg-card">
          <div className="font-bold mb-1">😕 Invitation introuvable</div>
          <p className="text-sm text-ink-soft">
            Ce lien de partage est invalide ou a été remplacé. Demande un
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
          <p className="mb-6 text-base text-sand">Tu es invité·e à</p>
          <div
            className="rounded-2xl p-5 mb-4 text-white"
            style={{ background: invite.color }}
          >
            <div className="text-2xl font-extrabold font-display leading-tight">
              {invite.title}
            </div>
            <div className="text-sm mt-2 font-semibold opacity-95">
              🗓 {longDate} à {invite.event_time.slice(0, 5)}
            </div>
            {invite.location_text && (
              <div className="text-sm font-semibold opacity-95">
                📍 {invite.location_text}
              </div>
            )}
            <div className="text-sm mt-1 opacity-90">
              {invite.yes_count}/{invite.max_participants} partant
              {invite.yes_count > 1 ? "s" : ""}
            </div>
          </div>

          {user ? (
            invite.already_in ? (
              <div className="rounded-2xl p-5 bg-card">
                <div className="font-bold mb-1">✓ Tu y as déjà accès !</div>
                <Link
                  href={`/evenements/${invite.event_id}`}
                  className="inline-block mt-2 w-full text-center px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
                >
                  Ouvrir l&apos;événement
                </Link>
              </div>
            ) : (
              <JoinEventButton token={token} title={invite.title} />
            )
          ) : (
            <JoinSignupForm label={invite.title} next={`/e/${token}`} />
          )}
        </>
      )}
    </div>
  );
}
