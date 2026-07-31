"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIST_COLORS } from "@/lib/list-colors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Visibility = "private" | "public";

type Input = {
  name: string;
  color: string;
  emoji: string | null;
  visibility: Visibility;
  contactIds: string[];
};

function validate(input: Input): string | null {
  const name = input.name.trim();
  if (!name) return "Donne un nom à ta liste.";
  if (name.length > 60) return "Ce nom est trop long (60 caractères max).";
  if (!LIST_COLORS.includes(input.color))
    return "Choisis une couleur dans la palette.";
  const emoji = (input.emoji ?? "").trim();
  if (emoji.length > 8) return "Emoji invalide.";
  if (input.visibility !== "private" && input.visibility !== "public")
    return "Visibilité invalide.";
  if (input.contactIds.some((id) => !UUID_RE.test(id)))
    return "Requête invalide.";
  return null;
}

export async function createBroadcastList(
  input: Input
): Promise<{ ok: false; error: string } | never> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("create_broadcast_list", {
    p_name: input.name.trim(),
    p_color: input.color,
    p_emoji: (input.emoji ?? "").trim() || null,
    p_visibility: input.visibility,
    p_contacts: input.contactIds,
  });
  if (error || !data)
    return {
      ok: false,
      error: "La création a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts/listes");
  redirect(`/contacts/listes/${data}`);
}

export async function updateBroadcastList(
  id: string,
  input: Input
): Promise<{ ok: false; error: string } | never> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Requête invalide." };
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("update_broadcast_list", {
    p_id: id,
    p_name: input.name.trim(),
    p_color: input.color,
    p_emoji: (input.emoji ?? "").trim() || null,
    p_visibility: input.visibility,
    p_contacts: input.contactIds,
  });
  if (error)
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts/listes");
  revalidatePath(`/contacts/listes/${id}`);
  redirect("/contacts/listes");
}

export async function deleteBroadcastList(
  id: string
): Promise<{ ok: false; error: string } | never> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Requête invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("delete_broadcast_list", { p_id: id });
  if (error)
    return {
      ok: false,
      error: "La suppression a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts/listes");
  redirect("/contacts/listes");
}

// Quitter une liste publique dont je suis abonné·e (mais pas propriétaire).
export async function leaveBroadcastList(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Requête invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("leave_broadcast_list", { p_id: id });
  if (error)
    return {
      ok: false,
      error: "Le retrait a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts/listes");
  return { ok: true };
}

// Rejoindre une liste publique depuis n'importe où (utilisé par /l/[id]).
export async function joinBroadcastList(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Requête invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("join_broadcast_list", { p_id: id });
  if (error)
    return {
      ok: false,
      error: error.message.endsWith(".")
        ? error.message
        : "L'inscription a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts/listes");
  revalidatePath(`/l/${id}`);
  return { ok: true };
}
