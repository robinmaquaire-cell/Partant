import Link from "next/link";

export const metadata = {
  title: "Conditions d'utilisation — Partants ?",
};

const h = "font-extrabold font-display text-lg mt-6 mb-2";
const p = "text-[15px] leading-relaxed text-ink mb-3";

export default function ConditionsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-lg mx-auto px-5 py-8">
        <Link href="/" className="inline-block text-sm font-bold mb-4 text-ink-soft">
          ← Retour
        </Link>
        <h1 className="text-2xl font-extrabold font-display mb-1">
          Conditions d&apos;utilisation et confidentialité
        </h1>
        <p className="text-sm text-ink-soft mb-4">Dernière mise à jour : juillet 2026</p>

        <h2 className={h}>Le service</h2>
        <p className={p}>
          « Partants ? » aide des groupes d&apos;amis à organiser des sorties :
          listes de diffusion privées, événements, réponses de participation et
          répartition du matériel. Le service est fourni tel quel, sans garantie
          de disponibilité, par son créateur, à titre non commercial.
        </p>

        <h2 className={h}>Ton compte</h2>
        <p className={p}>
          La connexion se fait par lien magique envoyé par e-mail — aucun mot de
          passe n&apos;est stocké. Tu es responsable de ce que tu publies
          (titres, descriptions, photos). Les listes sont privées : on ne les
          rejoint que sur invitation d&apos;un membre.
        </p>

        <h2 className={h}>Les données conservées</h2>
        <p className={p}>
          Uniquement ce qui fait fonctionner le service : ton adresse e-mail,
          ton pseudo, ta photo de profil si tu en ajoutes une, tes listes, tes
          événements, tes réponses et le matériel que tu proposes. Aucune
          donnée n&apos;est vendue, partagée ou utilisée pour de la publicité.
          Pas de traceurs : seuls des cookies techniques de connexion sont
          utilisés.
        </p>

        <h2 className={h}>Où sont-elles stockées ?</h2>
        <p className={p}>
          La base de données est hébergée par Supabase dans l&apos;Union
          européenne (Francfort, Allemagne). L&apos;application est servie par
          Vercel, et les e-mails de notification sont envoyés via Resend. Le
          choix du point de rendez-vous utilise les cartes d&apos;OpenStreetMap.
        </p>

        <h2 className={h}>Tes droits (RGPD)</h2>
        <p className={p}>
          Tu peux corriger tes informations à tout moment depuis ton profil, et
          supprimer ton compte au même endroit : cette suppression est
          immédiate et définitive (profil, réponses, contributions, ainsi que
          les événements que tu as créés). Pour toute question :{" "}
          <a href="mailto:robin.maquaire@gmail.com" className="underline text-river">
            robin.maquaire@gmail.com
          </a>
          .
        </p>

        <h2 className={h}>Bonne conduite</h2>
        <p className={p}>
          Ce service est fait pour organiser des sorties entre personnes qui se
          connaissent. Tout usage abusif (spam, contenu illégal ou nuisible)
          peut entraîner la suppression du compte.
        </p>
      </div>
    </div>
  );
}
