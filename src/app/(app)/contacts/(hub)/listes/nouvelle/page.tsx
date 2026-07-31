import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIST_COLORS } from "@/lib/list-colors";
import {
  BroadcastListForm,
  type ContactOption,
} from "../broadcast-list-form";

type ContactRow = {
  contact_id: string;
  pseudo: string | null;
  avatar_url: string | null;
};

export default async function NouvelleListeDiffusionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data } = await supabase.rpc("my_contacts");
  const contacts: ContactOption[] = ((data ?? []) as ContactRow[]).map((c) => ({
    id: c.contact_id,
    pseudo: c.pseudo || "(sans pseudo)",
    avatarUrl: c.avatar_url,
  }));

  return (
    <BroadcastListForm
      contacts={contacts}
      initial={{
        name: "",
        color: LIST_COLORS[0],
        emoji: null,
        visibility: "private",
        contactIds: [],
      }}
      mode={{ edit: false }}
    />
  );
}
