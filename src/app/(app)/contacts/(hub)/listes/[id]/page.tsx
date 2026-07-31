import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BroadcastListForm,
  type ContactOption,
} from "../broadcast-list-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ListRow = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  member_contact_ids: string[];
};

type ContactRow = {
  contact_id: string;
  pseudo: string | null;
  avatar_url: string | null;
};

export default async function ModifierListeDiffusionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [{ data: listData }, { data: contactData }] = await Promise.all([
    supabase.rpc("get_broadcast_list", { p_id: id }),
    supabase.rpc("my_contacts"),
  ]);
  const list = ((listData ?? []) as ListRow[])[0];
  if (!list) notFound();

  const contacts: ContactOption[] = ((contactData ?? []) as ContactRow[]).map(
    (c) => ({
      id: c.contact_id,
      pseudo: c.pseudo || "(sans pseudo)",
      avatarUrl: c.avatar_url,
    })
  );

  return (
    <BroadcastListForm
      contacts={contacts}
      initial={{
        name: list.name,
        color: list.color,
        emoji: list.emoji,
        contactIds: list.member_contact_ids ?? [],
      }}
      mode={{ edit: true, id: list.id }}
    />
  );
}
