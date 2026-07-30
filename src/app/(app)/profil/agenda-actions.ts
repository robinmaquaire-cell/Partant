"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUserCalendar } from "@/lib/agenda";

type Result = { ok: true; count?: number } | { ok: false; error: string };

// Nettoie l'adresse collée : accepte http(s) et convertit webcal:// (Apple)
// en https://. Renvoie null si ce n'est pas une adresse exploitable.
function normalizeUrl(raw: string): string | null {
  let u = (raw ?? "").trim();
  if (!u) return null;
  if (u.toLowerCase().startsWith("webcal://"))
    u = "https://" + u.slice("webcal://".length);
  if (!/^https?:\/\/.+/i.test(u)) return null;
  if (u.length > 1000) return null;
  return u;
}

// Relie (ou remplace) l'agenda perso, puis rafraîchit tout de suite les
// créneaux pour que la personne voie sa grille sans attendre.
export async function saveCalendarSource(rawUrl: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const url = normalizeUrl(rawUrl);
  if (!url)
    return {
      ok: false,
      error:
        "Colle une adresse d'agenda valide (elle commence par « https:// » ou « webcal:// »).",
    };

  const { error } = await supabase.from("calendar_sources").upsert(
    { user_id: user.id, kind: "ics", ics_url: url },
    { onConflict: "user_id" }
  );
  if (error)
    return { ok: false, error: "Enregistrement impossible. Réessaie dans un instant." };

  const admin = createAdminClient();
  if (!admin) {
    revalidatePath("/profil");
    return { ok: true };
  }
  const synced = await syncUserCalendar(admin, user.id, url);
  revalidatePath("/profil");
  if (!synced.ok) return { ok: false, error: synced.error };
  return { ok: true, count: synced.count };
}

// Relance le rafraîchissement à la demande.
export async function syncMyCalendar(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data: src } = await supabase
    .from("calendar_sources")
    .select("ics_url")
    .eq("user_id", user.id)
    .maybeSingle();
  const url = src?.ics_url as string | undefined;
  if (!url) return { ok: false, error: "Aucun agenda relié pour l'instant." };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error: "Le rafraîchissement n'est pas disponible sur cet environnement.",
    };
  const synced = await syncUserCalendar(admin, user.id, url);
  revalidatePath("/profil");
  if (!synced.ok) return { ok: false, error: synced.error };
  return { ok: true, count: synced.count };
}

// Active/désactive le partage de ma grille de dispo avec mes contacts.
export async function setBusyShare(share: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase
    .from("calendar_sources")
    .update({ busy_share: share })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Modification impossible." };
  revalidatePath("/profil");
  return { ok: true };
}

// Débranche l'agenda : on supprime la source et tous les créneaux stockés.
export async function disconnectCalendar(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  // Les créneaux ne sont effaçables que côté serveur (aucune écriture navigateur).
  const admin = createAdminClient();
  if (admin) await admin.from("busy_slots").delete().eq("user_id", user.id);

  const { error } = await supabase
    .from("calendar_sources")
    .delete()
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Suppression impossible." };
  revalidatePath("/profil");
  return { ok: true };
}
