import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchMyEvents } from "@/lib/my-events";
import { EventsView } from "@/components/events-view";

export default async function EvenementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const events = await fetchMyEvents(supabase, user.id);

  return <EventsView events={events} />;
}
