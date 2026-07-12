// Envoi d'e-mails via Resend (https://resend.com), sans SDK : l'API REST
// suffit. Si la clé n'est pas configurée, on n'envoie rien (utile en local).

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

const FROM = () =>
  process.env.EMAIL_FROM ?? "Partant ? <onboarding@resend.dev>";

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://partant-six.vercel.app"
  ).replace(/\/$/, "");
}

export async function sendEmails(messages: EmailMessage[]): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  if (!key || messages.length === 0) {
    if (!key && messages.length > 0)
      console.log(`[email] RESEND_API_KEY absente — ${messages.length} e-mail(s) non envoyé(s).`);
    return 0;
  }

  let sent = 0;
  // L'API « batch » accepte 100 messages par appel.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from: FROM(),
      to: [m.to],
      subject: m.subject,
      html: m.html,
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else console.error("[email] Envoi refusé :", res.status, await res.text());
    } catch (e) {
      console.error("[email] Envoi impossible :", e);
    }
  }
  return sent;
}

// ——— Modèles ———

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(content: string, footer: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F1F6F4;color:#10302C;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:0 auto;padding:24px 16px">
  <div style="font-size:24px;font-weight:800;margin-bottom:16px">Partant<span style="color:#FF6B35"> ?</span></div>
  <div style="background:#FFFFFF;border:1.5px solid #DCE6E2;border-radius:16px;padding:20px">${content}</div>
  <p style="font-size:12px;color:#3D5A55;margin-top:16px">${footer}</p>
</div></body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:#FF6B35;color:#FFFFFF;font-weight:700;padding:12px 20px;border-radius:12px;text-decoration:none">${label}</a>`;
}

function frenchDate(date: string): string {
  return new Date(date + "T00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function eventCreatedEmail(input: {
  to: string;
  eventId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  listNames: string[];
  creatorPseudo: string;
}): EmailMessage {
  const url = `${appUrl()}/evenements/${input.eventId}`;
  const title = escapeHtml(input.title);
  return {
    to: input.to,
    subject: `${input.title} — ${frenchDate(input.date)}`,
    html: layout(
      `<h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
<p style="margin:0 0 4px">🗓 ${frenchDate(input.date)} à ${escapeHtml(input.time)}</p>
${input.location ? `<p style="margin:0 0 4px">📍 ${escapeHtml(input.location)}</p>` : ""}
<p style="margin:0 0 16px;color:#3D5A55">Proposé par ${escapeHtml(input.creatorPseudo)} · ${escapeHtml(input.listNames.join(", "))}</p>
${button(url, "Partant ? Je réponds")}`,
      "Tu reçois cet e-mail parce que tu es membre de cette liste sur Partant ?."
    ),
  };
}

export function reminderEmail(input: {
  to: string;
  eventId: string;
  title: string;
  time: string;
  location: string;
  hasAnswered: boolean;
}): EmailMessage {
  const url = `${appUrl()}/evenements/${input.eventId}`;
  const title = escapeHtml(input.title);
  return {
    to: input.to,
    subject: `Demain : ${input.title} à ${input.time}`,
    html: layout(
      `<h1 style="font-size:20px;margin:0 0 8px">C'est demain !</h1>
<p style="margin:0 0 4px"><strong>${title}</strong></p>
<p style="margin:0 0 4px">🗓 Demain à ${escapeHtml(input.time)}</p>
${input.location ? `<p style="margin:0 0 16px">📍 ${escapeHtml(input.location)}</p>` : '<p style="margin:0 0 16px"></p>'}
${
  input.hasAnswered
    ? `<p style="margin:0 0 16px;color:#2E9E6B;font-weight:700">Tu as dit « Partant ! » — pense à ton matériel.</p>${button(url, "Revoir les détails")}`
    : `<p style="margin:0 0 16px;color:#3D5A55">Tu n'as pas encore répondu.</p>${button(url, "Je réponds maintenant")}`
}`,
      "Rappel automatique de Partant ? la veille de chaque événement."
    ),
  };
}

export function welcomeEmail(input: {
  to: string;
  pseudo: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: "Bienvenue sur Partant ? 🛶",
    html: layout(
      `<h1 style="font-size:20px;margin:0 0 8px">Bienvenue ${escapeHtml(input.pseudo)} !</h1>
<p style="margin:0 0 8px">Ton compte est prêt. Sur Partant ?, tu reçois les propositions de sortie de tes listes, tu réponds en un geste, et tu vois qui ramène quoi.</p>
<p style="margin:0 0 16px;color:#3D5A55">Astuce : ajoute l'application à ton écran d'accueil pour la retrouver comme une vraie appli.</p>
${button(appUrl(), "Ouvrir Partant ?")}`,
      "E-mail de bienvenue envoyé à la création de ton compte Partant ?."
    ),
  };
}
