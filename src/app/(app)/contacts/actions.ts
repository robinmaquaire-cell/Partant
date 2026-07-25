"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Ajouter un contact par e-mail ou pseudo.
export async function addContact(query: string): Promise<Result> {
  const q = query.trim();
  if (!q) return { ok: false, error: "Indique une adresse e-mail ou un pseudo." };
  if (q.length > 120) return { ok: false, error: "Saisie trop longue." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("add_manual_contact", {
    p_query: q,
  });
  if (error) return { ok: false, error: "L'ajout a échoué. Réessaie dans un instant." };
  if (data === "introuvable")
    return {
      ok: false,
      error:
        "Personne trouvée avec cet e-mail ou ce pseudo. Elle doit déjà avoir un compte Partants ? — sinon, envoie-lui plutôt un lien d'invitation.",
    };
  if (data === "soi")
    return { ok: false, error: "C'est toi 🙂" };

  revalidatePath("/contacts");
  return { ok: true };
}

export async function setContactBlocked(
  contactId: string,
  blocked: boolean
): Promise<Result> {
  if (!UUID_RE.test(contactId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_contact_blocked", {
    p_contact: contactId,
    p_blocked: blocked,
  });
  if (error)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function removeContact(contactId: string): Promise<Result> {
  if (!UUID_RE.test(contactId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("remove_contact", {
    p_contact: contactId,
  });
  if (error)
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };

  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true };
}
