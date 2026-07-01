"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true; info?: string } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function removeMember(
  listId: string,
  userId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(listId) || !UUID_RE.test(userId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };
  if (userId === user.id)
    return { ok: false, error: "Utilise « Quitter la liste » pour toi-même." };

  const { error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Le retrait a échoué." };

  revalidatePath(`/listes/${listId}`);
  return { ok: true };
}

export async function promoteMember(
  listId: string,
  userId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(listId) || !UUID_RE.test(userId))
    return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase
    .from("list_members")
    .update({ role: "admin" })
    .eq("list_id", listId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "La promotion a échoué." };

  revalidatePath(`/listes/${listId}`);
  return { ok: true };
}

export async function addMemberByEmail(
  listId: string,
  email: string
): Promise<ActionResult> {
  if (!UUID_RE.test(listId)) return { ok: false, error: "Requête invalide." };
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return { ok: false, error: "Cette adresse e-mail n'est pas valide." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("add_member_by_email", {
    p_list: listId,
    p_email: value,
  });
  if (error) return { ok: false, error: "L'ajout a échoué." };
  if (data === "introuvable")
    return {
      ok: false,
      error:
        "Personne avec cette adresse n'a encore de compte — envoie-lui plutôt le lien d'invitation.",
    };

  revalidatePath(`/listes/${listId}`);
  return { ok: true };
}

export async function regenerateInvite(listId: string): Promise<ActionResult> {
  if (!UUID_RE.test(listId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error: revokeError } = await supabase
    .from("list_invites")
    .update({ revoked: true })
    .eq("list_id", listId)
    .eq("revoked", false);
  if (revokeError) return { ok: false, error: "La révocation a échoué." };

  const token = randomBytes(12).toString("hex");
  const { error: insertError } = await supabase
    .from("list_invites")
    .insert({ token, list_id: listId, created_by: user.id });
  if (insertError)
    return { ok: false, error: "La création du nouveau lien a échoué." };

  revalidatePath(`/listes/${listId}`);
  return { ok: true, info: "Nouveau lien créé — l'ancien ne fonctionne plus." };
}

export async function leaveList(listId: string): Promise<ActionResult> {
  if (!UUID_RE.test(listId)) return { ok: false, error: "Requête invalide." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data: members } = await supabase
    .from("list_members")
    .select("user_id, role")
    .eq("list_id", listId);

  const me = members?.find((m) => m.user_id === user.id);
  if (!me) return { ok: false, error: "Tu n'es pas membre de cette liste." };

  const others = (members ?? []).filter((m) => m.user_id !== user.id);
  const otherAdmins = others.filter((m) => m.role === "admin");

  // Je suis le·la seul·e membre : quitter = supprimer la liste.
  if (others.length === 0) {
    await supabase.from("list_members").delete().eq("list_id", listId);
    await supabase.from("lists").delete().eq("id", listId);
    revalidatePath("/listes");
    redirect("/listes");
  }

  if (me.role === "admin" && otherAdmins.length === 0)
    return {
      ok: false,
      error:
        "Tu es le·la seul·e admin : promeus d'abord un autre membre admin avant de partir.",
    };

  const { error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Le départ a échoué." };

  revalidatePath("/listes");
  redirect("/listes");
}
