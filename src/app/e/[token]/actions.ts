"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Rejoindre un événement grâce à son lien de partage.
export async function joinEvent(
  token: string
): Promise<{ ok: false; error: string } | never> {
  if (!/^[0-9a-f]{8,64}$/i.test(token))
    return { ok: false, error: "Ce lien de partage est invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const { data, error } = await supabase.rpc("join_event", { p_token: token });
  if (error || !data)
    return {
      ok: false,
      error: "Impossible de rejoindre : le lien a peut-être été remplacé.",
    };

  revalidatePath("/");
  redirect(`/evenements/${data}`);
}
