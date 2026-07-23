"use server";

import { createClient } from "@/lib/supabase/server";

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
