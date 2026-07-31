"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function acceptContactInvite(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f]{16,64}$/i.test(token))
    return { ok: false, error: "Ce lien est invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("accept_contact_invite", {
    p_token: token,
  });
  if (error)
    return {
      ok: false,
      error: error.message.endsWith(".")
        ? error.message
        : "L'ajout a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/contacts");
  revalidatePath(`/c/${token}`);
  return { ok: true };
}
