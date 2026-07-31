"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function regenerateContactInviteToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc(
    "regenerate_contact_invite_token"
  );
  if (error || !data)
    return { ok: false, error: "La création du lien a échoué." };

  revalidatePath("/contacts");
  return { ok: true, token: data as string };
}
