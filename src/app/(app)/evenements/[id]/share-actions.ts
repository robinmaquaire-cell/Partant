"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Attache l'événement à un groupe supplémentaire.
export async function attachEventToGroup(
  eventId: string,
  listId: string
): Promise<Result> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(listId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("add_event_to_list", {
    p_event: eventId,
    p_list: listId,
  });
  if (error)
    return {
      ok: false,
      error: error.message.endsWith(".")
        ? error.message
        : "L'ajout a échoué. Réessaie dans un instant.",
    };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

// Détache l'événement d'un groupe.
export async function detachEventFromGroup(
  eventId: string,
  listId: string
): Promise<Result> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(listId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("remove_event_from_list", {
    p_event: eventId,
    p_list: listId,
  });
  if (error)
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true };
}

// Pousse l'événement à tous les membres d'une liste de diffusion.
export async function pushEventToBroadcast(
  eventId: string,
  listId: string
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(listId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("push_event_to_broadcast_list", {
    p_event: eventId,
    p_list: listId,
  });
  if (error)
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true, added: (data as number) ?? 0 };
}

// Invite des contacts individuels à un événement existant.
export async function inviteContactsToExistingEvent(
  eventId: string,
  contactIds: string[]
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Requête invalide." };
  const ids = (contactIds ?? []).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return { ok: true, added: 0 };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("invite_contacts_to_event", {
    p_event: eventId,
    p_contacts: ids,
  });
  if (error)
    return {
      ok: false,
      error: "L'invitation a échoué. Réessaie dans un instant.",
    };

  revalidatePath(`/evenements/${eventId}`);
  return { ok: true, added: (data as number) ?? 0 };
}
