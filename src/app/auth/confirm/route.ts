import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmails, welcomeEmail } from "@/lib/email";

// E-mail de bienvenue à la première connexion, une seule fois par compte
// (marqueur « welcomed » + compte créé il y a moins d'une heure).
async function maybeSendWelcome(supabase: SupabaseClient) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || user.user_metadata?.welcomed) return;
    if (Date.now() - new Date(user.created_at).getTime() > 60 * 60 * 1000)
      return;
    await supabase.auth.updateUser({ data: { welcomed: true } });
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .single();
    await sendEmails([
      welcomeEmail({
        to: user.email,
        pseudo: profile?.pseudo?.trim() || "à bord",
      }),
    ]);
  } catch (e) {
    console.error("[notif] E-mail de bienvenue échoué :", e);
  }
}

// Traduit l'erreur Supabase en un code que la page de connexion sait
// expliquer : lien remplacé/expiré, lien ouvert ailleurs, ou lien cassé.
function slugErreur(error: { code?: string } | null): string {
  switch (error?.code) {
    case "otp_expired":
      return "lien-expire";
    case "bad_code_verifier":
    case "flow_state_not_found":
    case "flow_state_expired":
      return "autre-navigateur";
    default:
      return "lien-invalide";
  }
}

// Point d'arrivée du lien magique : vérifie le jeton reçu par e-mail
// puis ouvre la session et renvoie vers l'application.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Sécurité : on n'accepte que des chemins internes à l'application.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Lien déjà mort (remplacé ou expiré) : Supabase renvoie ici sans jeton,
  // avec un code d'erreur dans l'URL. On affiche l'explication qui va bien.
  if (!tokenHash && !code && searchParams.get("error_code")) {
    return NextResponse.redirect(
      new URL(
        `/connexion?erreur=${
          searchParams.get("error_code") === "otp_expired"
            ? "lien-expire"
            : "lien-invalide"
        }`,
        origin
      )
    );
  }

  const supabase = await createClient();
  let derniereErreur: { code?: string } | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      await maybeSendWelcome(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    derniereErreur = error;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await maybeSendWelcome(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    derniereErreur = error;
  }

  return NextResponse.redirect(
    new URL(`/connexion?erreur=${slugErreur(derniereErreur)}`, origin)
  );
}
