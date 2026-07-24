"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, pushToUsers } from "@/lib/push";
import { appUrl } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

// Enregistrer l'abonnement d'un appareil (envoyé par le navigateur).
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}): Promise<Result> {
  if (!sub.endpoint || !sub.p256dh || !sub.auth)
    return { ok: false, error: "Abonnement incomplet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  // upsert : réactiver un appareil déjà connu ne crée pas de doublon.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: user.id,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" }
  );
  if (error)
    return { ok: false, error: "L'activation a échoué. Réessaie dans un instant." };

  return { ok: true };
}

// Bouton « Tester » : s'envoyer une notification à soi-même, pour vérifier
// toute la chaîne (clés serveur, abonnement, réception sur l'appareil).
export async function sendTestPush(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  if (!isPushConfigured())
    return {
      ok: false,
      error:
        "Les clés de notification ne sont pas configurées sur le serveur. (Variables VAPID à ajouter sur Vercel, puis redéployer.)",
    };

  // Combien d'appareils sont abonnés pour ce compte ?
  const { count } = await supabase
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count)
    return {
      ok: false,
      error:
        "Aucun appareil abonné pour ce compte. Active d'abord les notifications ci-dessus, sur l'application installée.",
    };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error:
        "Configuration serveur incomplète (clé service_role manquante sur Vercel).",
    };

  const sent = await pushToUsers(admin, [user.id], {
    title: "Partants ? — test 🎉",
    body: "Si tu vois cette notification, tout fonctionne !",
    url: `${appUrl()}/profil`,
    tag: "test-partant",
  });

  if (sent === 0)
    return {
      ok: false,
      error:
        "L'envoi a échoué côté serveur (l'abonnement est peut-être expiré). Désactive puis réactive les notifications, puis retente.",
    };

  return { ok: true };
}

// Retirer l'abonnement de cet appareil.
export async function deletePushSubscription(
  endpoint: string
): Promise<Result> {
  if (!endpoint) return { ok: false, error: "Requête invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error)
    return { ok: false, error: "La désactivation a échoué. Réessaie dans un instant." };

  return { ok: true };
}
