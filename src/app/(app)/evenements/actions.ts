"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyEventCreated } from "@/lib/notifications";

type ActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type EquipmentDraft = {
  name: string;
  kind: "indiv" | "collectif";
  qty: number | null;
};

export type EventInput = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  lat: number | null;
  lng: number | null;
  max: number;
  collaborative: boolean;
  listIds: string[];
  equipment: EquipmentDraft[];
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Les fonctions SQL renvoient déjà des messages d'erreur en français
// (elles se terminent par un point) ; sinon on affiche un message générique.
function frenchError(message: string | undefined, fallback: string): string {
  if (message && message.endsWith(".") && message.includes(" ")) return message;
  return fallback;
}

function checkEventInput(input: EventInput): string | null {
  if (!input.title.trim()) return "Donne un titre à ton événement.";
  if (input.title.trim().length > 80)
    return "Le titre est trop long (80 caractères max).";
  if (!DATE_RE.test(input.date)) return "Choisis une date.";
  if (!TIME_RE.test(input.time)) return "Choisis une heure.";
  if (input.description.length > 2000)
    return "La description est trop longue (2000 caractères max).";
  if (input.location.trim().length > 120)
    return "Le lieu est trop long (120 caractères max).";
  if ((input.lat === null) !== (input.lng === null))
    return "Point GPS incomplet.";
  if (
    input.lat !== null &&
    input.lng !== null &&
    (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180)
  )
    return "Point GPS invalide.";
  if (!Number.isInteger(input.max) || input.max < 1 || input.max > 1000)
    return "Le nombre max de participants doit être entre 1 et 1000.";
  if (input.listIds.length === 0)
    return "Choisis au moins une liste de diffusion.";
  if (input.listIds.some((id) => !UUID_RE.test(id))) return "Requête invalide.";
  for (const it of input.equipment) {
    if (!it.name.trim() || it.name.trim().length > 60)
      return "Chaque objet de matériel doit avoir un nom (60 caractères max).";
    if (it.kind !== "indiv" && it.kind !== "collectif")
      return "Type de matériel invalide.";
    const qty = it.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 999)
      return "La quantité doit être entre 1 et 999.";
  }
  return null;
}

function equipmentJson(equipment: EquipmentDraft[]) {
  return equipment.map((it) => ({
    name: it.name.trim(),
    kind: it.kind,
    qty: it.qty ?? 1,
  }));
}

export async function createEvent(
  input: EventInput,
  templateName: string | null
): Promise<{ ok: false; error: string } | never> {
  const problem = checkEventInput(input);
  if (problem) return { ok: false, error: problem };
  if (templateName !== null && (!templateName.trim() || templateName.trim().length > 60))
    return { ok: false, error: "Donne un nom au template (60 caractères max)." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("create_event", {
    p_title: input.title.trim(),
    p_description: input.description,
    p_event_date: input.date,
    p_event_time: input.time,
    p_location_text: input.location.trim(),
    p_lat: input.lat,
    p_lng: input.lng,
    p_max: input.max,
    p_collaborative: input.collaborative,
    p_list_ids: input.listIds,
    p_equipment: equipmentJson(input.equipment),
    p_template_name: templateName ? templateName.trim() : null,
  });

  if (error || !data)
    return {
      ok: false,
      error: frenchError(error?.message, "La création a échoué. Réessaie dans un instant."),
    };

  // Prévenir les membres par e-mail (ne bloque jamais la création).
  await notifyEventCreated(data);

  revalidatePath("/");
  redirect(`/evenements/${data}`);
}

export async function updateEvent(
  eventId: string,
  input: EventInput,
  equipmentRemoved: string[]
): Promise<{ ok: false; error: string } | never> {
  if (!UUID_RE.test(eventId) || equipmentRemoved.some((id) => !UUID_RE.test(id)))
    return { ok: false, error: "Requête invalide." };
  const problem = checkEventInput(input);
  if (problem) return { ok: false, error: problem };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("update_event", {
    p_event: eventId,
    p_title: input.title.trim(),
    p_description: input.description,
    p_event_date: input.date,
    p_event_time: input.time,
    p_location_text: input.location.trim(),
    p_lat: input.lat,
    p_lng: input.lng,
    p_max: input.max,
    p_collaborative: input.collaborative,
    p_list_ids: input.listIds,
    p_equipment_new: equipmentJson(input.equipment),
    p_equipment_removed: equipmentRemoved,
  });

  if (error)
    return {
      ok: false,
      error: frenchError(error.message, "La modification a échoué. Réessaie dans un instant."),
    };

  revalidatePath("/");
  revalidatePath(`/evenements/${eventId}`);
  redirect(`/evenements/${eventId}`);
}

export async function deleteEvent(
  eventId: string
): Promise<{ ok: false; error: string } | never> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error)
    return { ok: false, error: "La suppression a échoué. Réessaie dans un instant." };

  revalidatePath("/");
  redirect("/");
}

// Promouvoir un partant en organisateur (réservé aux organisateurs).
export async function addOrganizer(
  eventId: string,
  userId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(userId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("add_organizer", {
    p_event: eventId,
    p_user: userId,
  });
  if (error)
    return {
      ok: false,
      error: frenchError(error.message, "La nomination a échoué."),
    };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

// Se désinscrire d'un événement qu'on organise.
export async function resignOrganizer(
  eventId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("remove_organizer", {
    p_event: eventId,
  });
  if (error)
    return {
      ok: false,
      error: frenchError(error.message, "La désinscription a échoué."),
    };

  revalidatePath(`/evenements/${eventId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setRsvp(
  eventId: string,
  status: "yes" | "no"
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId) || (status !== "yes" && status !== "no"))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_rsvp", {
    p_event: eventId,
    p_status: status,
  });
  if (error)
    return {
      ok: false,
      error: frenchError(error.message, "La réponse n'a pas pu être enregistrée."),
    };

  revalidatePath(`/evenements/${eventId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setContribution(
  eventId: string,
  itemId: string,
  qty: number
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(itemId))
    return { ok: false, error: "Requête invalide." };
  if (!Number.isInteger(qty) || qty < 0 || qty > 999)
    return { ok: false, error: "Quantité invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_contribution", {
    p_item: itemId,
    p_qty: qty,
  });
  if (error)
    return {
      ok: false,
      error: frenchError(error.message, "L'enregistrement a échoué. Réessaie dans un instant."),
    };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

export async function setConfirmation(
  eventId: string,
  itemId: string,
  haveIt: boolean
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(itemId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = haveIt
    ? await supabase
        .from("equipment_confirmations")
        .upsert(
          { item_id: itemId, user_id: user.id },
          { ignoreDuplicates: true }
        )
    : await supabase
        .from("equipment_confirmations")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", user.id);

  if (error)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

// Mode collaboratif : un participant ajoute ce qu'il ramène
// (et sa contribution couvre d'office la quantité annoncée).
export async function addOwnItem(
  eventId: string,
  name: string,
  qty: number
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Requête invalide." };
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60)
    return { ok: false, error: "Donne un nom à l'objet (60 caractères max)." };
  if (!Number.isInteger(qty) || qty < 1 || qty > 999)
    return { ok: false, error: "La quantité doit être entre 1 et 999." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data: item, error } = await supabase
    .from("equipment_items")
    .insert({
      event_id: eventId,
      name: trimmed,
      kind: "collectif",
      qty,
      added_by: user.id,
    })
    .select("id")
    .single();

  if (error || !item)
    return { ok: false, error: "L'ajout a échoué. Réessaie dans un instant." };

  await supabase.rpc("set_contribution", { p_item: item.id, p_qty: qty });

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

export async function removeOwnItem(
  eventId: string,
  itemId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(itemId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase
    .from("equipment_items")
    .delete()
    .eq("id", itemId);
  if (error)
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}
