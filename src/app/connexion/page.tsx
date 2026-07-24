import { LoginForm } from "./login-form";

export default async function ConnexionPage(props: {
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  const { erreur, info } = await props.searchParams;
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-pine">
      <div className="text-5xl font-extrabold mb-2 font-display text-paper">
        Partants<span className="text-signal"> ?</span>
      </div>
      <p className="mb-8 text-base text-sand">
        Organise des sorties entre potes, sans noyer les groupes de discussion.
      </p>
      {info === "compte-supprime" && (
        <div className="rounded-2xl p-4 mb-4 bg-card">
          <p className="text-sm font-semibold text-ok">
            ✓ Ton compte et tes données ont été supprimés. À bientôt
            peut-être !
          </p>
        </div>
      )}
      {configured ? (
        <LoginForm erreur={erreur} />
      ) : (
        <div className="rounded-2xl p-5 bg-card">
          <div className="font-bold mb-1">⚙️ Configuration en cours</div>
          <p className="text-sm text-ink-soft">
            La base de données Supabase n&apos;est pas encore connectée. Les
            clés seront ajoutées dans le fichier <code>.env.local</code> et
            cette page s&apos;activera toute seule.
          </p>
        </div>
      )}
    </div>
  );
}
