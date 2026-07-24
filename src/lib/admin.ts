import "server-only";

// Normalise une adresse e-mail pour comparaison. Pour Gmail, les points du
// nom et les « +étiquettes » sont ignorés (robin.maquaire = robinmaquaire).
function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return e;
}

// La liste des administrateurs : variable ADMIN_EMAILS (séparée par des
// virgules) si définie, sinon l'adresse du porteur du projet par défaut.
function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "robin.maquaire@gmail.com";
  return raw
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

// Cette personne est-elle administratrice ? (accès à l'écran des retours)
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(normalizeEmail(email));
}
