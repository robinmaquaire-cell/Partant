import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactsView, type Contact } from "../contacts-view";

type ContactRow = {
  contact_id: string;
  pseudo: string | null;
  avatar_url: string | null;
  blocked: boolean;
  manual: boolean;
  via_list: boolean;
  via_event: boolean;
};

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data } = await supabase.rpc("my_contacts");
  const contacts: Contact[] = ((data ?? []) as ContactRow[]).map((c) => ({
    id: c.contact_id,
    pseudo: c.pseudo || "(sans pseudo)",
    avatarUrl: c.avatar_url,
    blocked: c.blocked,
    manual: c.manual,
    viaList: c.via_list,
    viaEvent: c.via_event,
  }));

  return <ContactsView contacts={contacts} />;
}
