"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Une liste de diffusion alimente (ou non) mon calendrier.
export async function setListInCalendar(
  listId: string,
  on: boolean
): Promise<ActionResult> {
  if (!UUID_RE.test(listId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_list_in_calendar", {
    p_list: listId,
    p_on: on,
  });
  if (error)
    return { ok: false, error: "La modification a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}

export type SyncPrefs = {
  onlyYes: boolean;
  includeGuestEvents: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  categories: string[] | null; // null = toutes
};

// Les règles générales du calendrier synchronisé.
export async function saveSyncPrefs(prefs: SyncPrefs): Promise<ActionResult> {
  if (prefs.dateFrom !== null && !DATE_RE.test(prefs.dateFrom))
    return { ok: false, error: "Date de début invalide." };
  if (prefs.dateTo !== null && !DATE_RE.test(prefs.dateTo))
    return { ok: false, error: "Date de fin invalide." };
  if (
    prefs.dateFrom !== null &&
    prefs.dateTo !== null &&
    prefs.dateFrom > prefs.dateTo
  )
    return { ok: false, error: "La date de fin doit suivre la date de début." };
  if (prefs.categories !== null && prefs.categories.some((c) => c.length > 30))
    return { ok: false, error: "Catégorie invalide." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.from("calendar_prefs").upsert({
    user_id: user.id,
    only_yes: prefs.onlyYes,
    include_guest_events: prefs.includeGuestEvents,
    date_from: prefs.dateFrom,
    date_to: prefs.dateTo,
    categories:
      prefs.categories === null || prefs.categories.length === 0
        ? null
        : prefs.categories,
  });
  if (error)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}

// Exception pour un événement précis (included = null : retour à la règle).
export async function setEventSync(
  eventId: string,
  included: boolean | null
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_calendar_override", {
    p_event: eventId,
    p_included: included,
  });
  if (error)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}

// Changer de lien de calendrier : l'ancien cesse aussitôt de fonctionner.
export async function resetCalendarToken(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("reset_calendar_token");
  if (error)
    return { ok: false, error: "La création du lien a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}
