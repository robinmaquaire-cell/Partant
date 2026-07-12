import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm, type TemplatePayload } from "../event-form";

export default async function NouvelEvenementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [{ data: lists }, { data: templates }] = await Promise.all([
    supabase.rpc("my_lists"),
    supabase
      .from("templates")
      .select("id, name, payload")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <EventForm
      lists={(lists ?? []).map(
        (l: { id: string; name: string; color: string }) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        })
      )}
      templates={(templates ?? []).map(
        (t: { id: string; name: string; payload: TemplatePayload }) => ({
          id: t.id,
          name: t.name,
          payload: t.payload,
        })
      )}
    />
  );
}
