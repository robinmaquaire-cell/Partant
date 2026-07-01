"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinList(
  token: string
): Promise<{ ok: false; error: string } | never> {
  if (!/^[0-9a-f]{8,64}$/i.test(token))
    return { ok: false, error: "Ce lien d'invitation est invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const { data, error } = await supabase.rpc("join_list", { p_token: token });
  if (error || !data)
    return {
      ok: false,
      error: "Impossible de rejoindre : le lien est peut-être révoqué.",
    };

  revalidatePath("/listes");
  redirect(`/listes/${data}`);
}
