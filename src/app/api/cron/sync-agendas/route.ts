import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncUserCalendar } from "@/lib/agenda";

// La lecture de plusieurs agendas peut prendre un moment.
export const maxDuration = 60;

// Appelée chaque jour par la tâche planifiée Vercel (voir vercel.json) :
// rafraîchit les créneaux occupés de chaque agenda relié.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY manquante." },
      { status: 500 }
    );

  const { data } = await admin
    .from("calendar_sources")
    .select("user_id, ics_url")
    .not("ics_url", "is", null);
  const sources = (data ?? []) as { user_id: string; ics_url: string }[];

  let ok = 0;
  let fail = 0;
  for (const s of sources) {
    const r = await syncUserCalendar(admin, s.user_id, s.ics_url);
    if (r.ok) ok++;
    else fail++;
  }

  console.log(
    `[cron] Agendas : ${sources.length} source(s), ${ok} rafraîchie(s), ${fail} en échec.`
  );
  return NextResponse.json({ sources: sources.length, ok, fail });
}
