import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase à chaque requête et protège les pages :
// sans connexion, on est renvoyé vers /connexion.
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase pas encore configuré : on laisse passer, la page de
  // connexion affichera un message explicite.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Important : ne rien insérer entre la création du client et getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /j/… = pages d'invitation, accessibles sans compte (c'est le parcours d'inscription).
  const isPublic =
    path.startsWith("/connexion") ||
    path.startsWith("/auth") ||
    path.startsWith("/j/") ||
    path.startsWith("/conditions") ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    // Le flux d'agenda est appelé par Google/Apple, sans session :
    // c'est le jeton secret dans l'URL qui identifie la personne.
    path.startsWith("/api/calendrier/") ||
    // La tâche planifiée Vercel n'a pas de session : elle est protégée
    // par son propre secret (CRON_SECRET) dans la route.
    path.startsWith("/api/cron/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/connexion")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Chaque compte doit avoir un pseudo : tant qu'il manque, direction le profil.
  if (
    user &&
    !isPublic &&
    !path.startsWith("/profil") &&
    !path.startsWith("/api/")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.pseudo?.trim()) {
      const url = request.nextUrl.clone();
      url.pathname = "/profil";
      url.search = "?bienvenue=1";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
