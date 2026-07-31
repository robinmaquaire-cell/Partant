"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIST_COLORS } from "@/lib/list-colors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createList(input: {
  name: string;
  color: string;
  membersVisible: boolean;
  emoji: string | null;
  memberIds: string[];
}): Promise<{ ok: false; error: string } | never> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donne un nom à ton groupe." };
  if (name.length > 60)
    return { ok: false, error: "Ce nom est trop long (60 caractères max)." };
  if (!LIST_COLORS.includes(input.color))
    return { ok: false, error: "Choisis une couleur dans la palette." };
  const emoji = (input.emoji ?? "").trim();
  if (emoji.length > 8) return { ok: false, error: "Logo invalide." };
  const memberIds = (input.memberIds ?? []).filter((id) => UUID_RE.test(id));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_list", {
    p_name: name,
    p_color: input.color,
    p_members_visible: input.membersVisible,
    p_emoji: emoji || null,
  });

  if (error || !data)
    return {
      ok: false,
      error: "La création a échoué. Réessaie dans un instant.",
    };

  // Ajouter les contacts choisis (ne bloque pas la création si ça échoue).
  if (memberIds.length > 0) {
    await supabase.rpc("add_members_to_list", {
      p_list: data,
      p_users: memberIds,
    });
  }

  revalidatePath("/contacts/groupes");
  redirect(`/listes/${data}`);
}
