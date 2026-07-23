import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Un envoi de notification push : titre, texte, et page à ouvrir au clic.
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string; // regroupe les notifs d'un même événement
};

let configured: boolean | null = null;

// Prépare la librairie avec les clés VAPID (l'identité de l'expéditeur).
// Renvoie false si les clés ne sont pas configurées : on n'envoie alors rien.
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.log("[push] Clés VAPID absentes — notifications push non envoyées.");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@partant.app",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Envoie une notification à tous les appareils des personnes visées.
// `admin` est le client service_role (il lit tous les abonnements).
// Ne bloque jamais l'appelant : les erreurs sont tracées, pas propagées.
export async function pushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  if (!ensureConfigured() || userIds.length === 0) return 0;

  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", [...new Set(userIds)]);
  const subs = (data ?? []) as SubRow[];
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = l'abonnement n'existe plus (appli désinstallée, notifs
        // coupées) : on le retire pour ne pas réessayer indéfiniment.
        if (status === 404 || status === 410) stale.push(s.endpoint);
        else console.error("[push] Envoi refusé :", status ?? e);
      }
    })
  );

  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", stale);
  }
  return sent;
}
