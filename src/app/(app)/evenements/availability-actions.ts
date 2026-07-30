"use server";

import { createClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Décalage (en minutes) de Paris par rapport à UTC à un instant donné.
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((a, p) => {
      a[p.type] = p.value;
      return a;
    }, {});
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return (asUtc - at.getTime()) / 60000;
}

// Convertit une heure « murale » de Paris (date + HH:MM) en instant UTC.
function parisToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = parisOffsetMinutes(new Date(guess));
  return new Date(guess - off * 60000);
}

export type Availability = "busy" | "free" | "unknown";

// Pour chaque contact choisi, dit s'il est occupé au créneau de l'événement.
// « unknown » = pas d'agenda relié, ou dispo non partagée.
export async function checkAvailability(
  date: string,
  time: string,
  contactIds: string[]
): Promise<{ ok: false; error: string } | { ok: true; results: Record<string, Availability> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  if (!DATE_RE.test(date)) return { ok: false, error: "Choisis d'abord une date." };
  const ids = (Array.isArray(contactIds) ? contactIds : [])
    .filter((id) => UUID_RE.test(id))
    .slice(0, 50);
  if (ids.length === 0) return { ok: true, results: {} };

  // Fenêtre vérifiée : 2 h à partir de l'heure (ou la journée si pas d'heure).
  const hasTime = TIME_RE.test(time);
  const from = parisToUtc(date, hasTime ? time : "00:00");
  const to = hasTime
    ? new Date(from.getTime() + 2 * 3600 * 1000)
    : new Date(from.getTime() + 24 * 3600 * 1000);

  const { data, error } = await supabase.rpc("contacts_busy_between", {
    p_contacts: ids,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) return { ok: false, error: "Vérification impossible pour l'instant." };

  const results: Record<string, Availability> = {};
  for (const id of ids) results[id] = "unknown";
  for (const row of (data ?? []) as { contact_id: string; busy: boolean }[])
    results[row.contact_id] = row.busy ? "busy" : "free";
  return { ok: true, results };
}

// Grille occupé/libre d'un contact autour de la date de l'événement
// (la veille + les 5 jours suivants), pour voir quand il est libre.
export async function contactGrid(
  contactId: string,
  date: string
): Promise<{ ok: false; error: string } | { ok: true; slots: { start: string; end: string }[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };
  if (!UUID_RE.test(contactId) || !DATE_RE.test(date))
    return { ok: false, error: "Requête invalide." };

  const from = parisToUtc(date, "00:00");
  const gridFrom = new Date(from.getTime() - 24 * 3600 * 1000);
  const gridTo = new Date(from.getTime() + 6 * 24 * 3600 * 1000);

  const { data, error } = await supabase.rpc("contact_busy", {
    p_contact: contactId,
    p_from: gridFrom.toISOString(),
    p_to: gridTo.toISOString(),
  });
  if (error) return { ok: false, error: "Lecture impossible." };

  const slots = ((data ?? []) as { starts_at: string; ends_at: string }[]).map(
    (s) => ({ start: s.starts_at, end: s.ends_at })
  );
  return { ok: true, slots };
}
