"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AccountType = "perso" | "pro";

export async function setAccountType(
  type: AccountType
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (type !== "perso" && type !== "pro")
    return { ok: false, error: "Type de compte invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_account_type", { p_type: type });
  if (error)
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/profil");
  return { ok: true };
}
