"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_MODES = ["email", "whatsapp", "sms"] as const;

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: {
  pseudo: string;
  contactMode: string;
  contact: string;
}): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const pseudo = input.pseudo.trim();
  const contact = input.contact.trim();
  const contactMode = input.contactMode;

  if (!pseudo) return { ok: false, error: "Renseigne un pseudo." };
  if (pseudo.length > 40)
    return { ok: false, error: "Ce pseudo est trop long (40 caractères max)." };
  if (!CONTACT_MODES.includes(contactMode as (typeof CONTACT_MODES)[number]))
    return { ok: false, error: "Mode de contact inconnu." };
  if (contactMode === "email" && !EMAIL_RE.test(contact))
    return { ok: false, error: "Cette adresse e-mail n'est pas valide." };
  if (contactMode !== "email" && contact.replace(/\D/g, "").length < 6)
    return { ok: false, error: "Ce numéro semble incomplet." };

  const { error } = await supabase
    .from("profiles")
    .update({ pseudo, contact_mode: contactMode, contact })
    .eq("id", user.id);

  if (error)
    return {
      ok: false,
      error: "La sauvegarde a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/", "layout");
  return { ok: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteTemplate(
  templateId: string
): Promise<UpdateProfileResult> {
  if (!UUID_RE.test(templateId)) return { ok: false, error: "Requête invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId);
  if (error)
    return { ok: false, error: "La suppression a échoué. Réessaie dans un instant." };

  revalidatePath("/profil");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
