import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm, type TemplatePayload } from "../event-form";
import { listOptionsFrom, type MyListRow } from "../list-options";

export default async function NouvelEvenementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [{ data: lists }, { data: templates }, { data: cats }] =
    await Promise.all([
      supabase.rpc("my_lists"),
      supabase
        .from("templates")
        .select("id, name, payload")
        .order("created_at", { ascending: true }),
      // Les catégories déjà utilisées, proposées en suggestion.
      supabase.from("events").select("category").not("category", "is", null),
    ]);

  return (
    <EventForm
      lists={listOptionsFrom((lists ?? []) as MyListRow[])}
      categories={[
        ...new Set(
          ((cats ?? []) as { category: string | null }[])
            .map((c) => (c.category ?? "").trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, "fr"))}
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
