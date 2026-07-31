// L'origine officielle de l'app (https://partants.app), à utiliser côté
// client pour construire les liens copiables et les redirections magiques.
//
// Aujourd'hui l'app est joignable sur deux domaines :
//   • partants.app (le vrai)
//   • partant-six.vercel.app (l'ancien, avant renommage)
//
// Sans précaution, `window.location.origin` renverrait l'ancien domaine
// si la personne y est encore, et on répandrait des liens périmés dans
// WhatsApp, e-mails de lien magique, etc. On préfère donc :
//   1. La variable d'environnement NEXT_PUBLIC_APP_URL si elle vaut
//      quelque chose de non-Vercel (mise en prod : partants.app) ;
//   2. Sinon, l'origine courante du navigateur.
export function siteOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (configured && !configured.includes(".vercel.app")) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://partants.app";
}
