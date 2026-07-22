"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: {
  pseudo: string;
  contact: string;
  emailNotifications: boolean;
}): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const pseudo = input.pseudo.trim();
  const contact = input.contact.trim();

  if (!pseudo) return { ok: false, error: "Renseigne un pseudo." };
  if (pseudo.length > 40)
    return { ok: false, error: "Ce pseudo est trop long (40 caractères max)." };
  if (!EMAIL_RE.test(contact))
    return { ok: false, error: "Cette adresse e-mail n'est pas valide." };

  const { error } = await supabase
    .from("profiles")
    .update({
      pseudo,
      contact_mode: "email",
      contact,
      email_notifications: input.emailNotifications,
    })
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

// Suppression de compte (RGPD) : immédiate et définitive. Les données
// liées (profil, réponses, contributions, événements créés) partent en
// cascade avec le compte.
export async function deleteAccount(): Promise<
  { ok: false; error: string } | never
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error:
        "La suppression est indisponible sur cet environnement. Réessaie sur le site en ligne.",
    };

  // La photo de profil d'abord (elle ne part pas en cascade).
  await admin.storage.from("avatars").remove([`${user.id}/avatar`]);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error)
    return {
      ok: false,
      error: "La suppression a échoué. Réessaie dans un instant.",
    };

  await supabase.auth.signOut();
  redirect("/connexion?info=compte-supprime");
}
