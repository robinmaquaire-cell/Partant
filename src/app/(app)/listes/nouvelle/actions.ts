"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIST_COLORS } from "@/lib/list-colors";

export async function createList(input: {
  name: string;
  color: string;
  membersVisible: boolean;
}): Promise<{ ok: false; error: string } | never> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donne un nom à ta liste." };
  if (name.length > 60)
    return { ok: false, error: "Ce nom est trop long (60 caractères max)." };
  if (!LIST_COLORS.includes(input.color))
    return { ok: false, error: "Choisis une couleur dans la palette." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_list", {
    p_name: name,
    p_color: input.color,
    p_members_visible: input.membersVisible,
  });

  if (error || !data)
    return {
      ok: false,
      error: "La création a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/listes");
  redirect(`/listes/${data}`);
}
