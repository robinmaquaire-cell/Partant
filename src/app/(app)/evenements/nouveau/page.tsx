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

  const [{ data: lists }, { data: templates }, { data: cats }, { data: contacts }] =
    await Promise.all([
      supabase.rpc("my_lists"),
      supabase
        .from("templates")
        .select("id, name, payload")
        .order("created_at", { ascending: true }),
      // Les tags déjà utilisés, proposés en suggestion.
      supabase.from("events").select("tags"),
      // Mes contacts, pour vérifier leurs disponibilités (hors bloqués).
      supabase.rpc("my_contacts"),
    ]);

  return (
    <EventForm
      // L'aide vocale n'apparaît que si la clé Anthropic est configurée
      // (sinon le bouton mènerait à un cul-de-sac). Voir voice-actions.ts.
      voiceEnabled={!!process.env.ANTHROPIC_API_KEY}
      contacts={(
        (contacts ?? []) as {
          contact_id: string;
          pseudo: string | null;
          avatar_url: string | null;
          blocked: boolean;
        }[]
      )
        .filter((c) => !c.blocked)
        .map((c) => ({
          id: c.contact_id,
          pseudo: c.pseudo || "(sans pseudo)",
          avatarUrl: c.avatar_url,
        }))}
      lists={listOptionsFrom((lists ?? []) as MyListRow[])}
      usedTags={[
        ...new Set(
          ((cats ?? []) as { tags: string[] | null }[])
            .flatMap((c) => c.tags ?? [])
            .map((t) => t.trim())
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
