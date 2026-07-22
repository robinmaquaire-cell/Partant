import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderEmail, sendEmails, type EmailMessage } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// La date de « demain » vue depuis la France (le serveur, lui, vit en UTC).
function tomorrowInParis(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

type EventRow = {
  id: string;
  title: string;
  event_time: string;
  location_text: string;
  event_lists: { list_id: string }[];
  event_guests: { user_id: string }[];
  rsvps: { user_id: string; status: "yes" | "no" }[];
};

type MemberRow = {
  list_id: string;
  user_id: string;
  profiles: {
    contact_mode: string;
    contact: string | null;
  } | null;
};

// Appelée chaque soir par la tâche planifiée Vercel (voir vercel.json) :
// envoie le rappel « c'est demain » aux membres qui n'ont pas dit non.
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

  const tomorrow = tomorrowInParis();
  const { data: eventData, error } = await admin
    .from("events")
    .select(
      "id, title, event_time, location_text, event_lists(list_id), event_guests(user_id), rsvps(user_id, status)"
    )
    .eq("event_date", tomorrow);
  if (error)
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });

  const events = (eventData ?? []) as unknown as EventRow[];
  if (events.length === 0)
    return NextResponse.json({ date: tomorrow, events: 0, sent: 0 });

  // Tous les membres de toutes les listes concernées, en une requête.
  const allListIds = [
    ...new Set(events.flatMap((e) => e.event_lists.map((el) => el.list_id))),
  ];
  const { data: memberData } = await admin
    .from("list_members")
    .select("list_id, user_id, profiles(contact_mode, contact)")
    .in("list_id", allListIds);
  const members = (memberData ?? []) as unknown as MemberRow[];

  // Les personnes arrivées par un lien de partage sont prévenues aussi.
  const guestIds = [
    ...new Set(events.flatMap((e) => e.event_guests.map((g) => g.user_id))),
  ];
  const { data: guestProfiles } = guestIds.length
    ? await admin
        .from("profiles")
        .select("id, contact_mode, contact")
        .in("id", guestIds)
    : { data: [] };
  const contactOf = new Map(
    (guestProfiles ?? []).map((p) => [
      p.id,
      { contact_mode: p.contact_mode as string, contact: p.contact as string | null },
    ])
  );

  const messages: EmailMessage[] = [];
  for (const ev of events) {
    const evListIds = new Set(ev.event_lists.map((el) => el.list_id));
    const noSet = new Set(
      ev.rsvps.filter((r) => r.status === "no").map((r) => r.user_id)
    );
    const yesSet = new Set(
      ev.rsvps.filter((r) => r.status === "yes").map((r) => r.user_id)
    );
    const seen = new Set<string>();
    for (const m of members) {
      if (!evListIds.has(m.list_id) || seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      if (noSet.has(m.user_id)) continue; // « Pas dispo » : on ne relance pas.
      const p = m.profiles;
      if (!p || p.contact_mode !== "email") continue;
      const email = (p.contact ?? "").trim();
      if (!EMAIL_RE.test(email)) continue;
      messages.push(
        reminderEmail({
          to: email,
          eventId: ev.id,
          title: ev.title,
          time: ev.event_time.slice(0, 5),
          location: ev.location_text,
          hasAnswered: yesSet.has(m.user_id),
        })
      );
    }
    for (const g of ev.event_guests) {
      if (seen.has(g.user_id) || noSet.has(g.user_id)) continue;
      seen.add(g.user_id);
      const p = contactOf.get(g.user_id);
      if (!p || p.contact_mode !== "email") continue;
      const email = (p.contact ?? "").trim();
      if (!EMAIL_RE.test(email)) continue;
      messages.push(
        reminderEmail({
          to: email,
          eventId: ev.id,
          title: ev.title,
          time: ev.event_time.slice(0, 5),
          location: ev.location_text,
          hasAnswered: yesSet.has(g.user_id),
        })
      );
    }
  }

  const sent = await sendEmails(messages);
  console.log(`[cron] Rappel J-1 du ${tomorrow} : ${events.length} événement(s), ${sent} e-mail(s).`);
  return NextResponse.json({ date: tomorrow, events: events.length, sent });
}
