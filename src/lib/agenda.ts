import "server-only";
import IcalExpander from "ical-expander";
import type { SupabaseClient } from "@supabase/supabase-js";

// On regarde les 90 prochains jours, largement assez pour vérifier une dispo.
const HORIZON_DAYS = 90;
// Garde-fou : un agenda très chargé ne remplira pas la base à l'infini.
const MAX_SLOTS = 2000;

export type SyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

// Télécharge un agenda .ics et en extrait UNIQUEMENT les créneaux occupés
// (début/fin) des 90 prochains jours. Aucun titre ni lieu n'est conservé.
export async function fetchBusySlots(
  url: string
): Promise<{ ok: true; slots: [Date, Date][] } | { ok: false; error: string }> {
  let ics: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "PartantApp/1.0 (calendrier de disponibilité)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      return {
        ok: false,
        error: `Le lien a répondu « ${res.status} ». Vérifie que l'adresse est complète.`,
      };
    ics = await res.text();
  } catch {
    return {
      ok: false,
      error:
        "Impossible de lire ce lien. Vérifie qu'il est complet et bien de type « iCal » (.ics).",
    };
  }

  if (!/BEGIN:VCALENDAR/i.test(ics))
    return {
      ok: false,
      error:
        "Ce lien ne ressemble pas à un agenda. Recopie l'adresse « secrète au format iCal ».",
    };

  const now = Date.now();
  const from = new Date(now - 24 * 3600 * 1000);
  const to = new Date(now + HORIZON_DAYS * 24 * 3600 * 1000);

  let raw: [Date, Date][];
  try {
    const expander = new IcalExpander({ ics, maxIterations: 5000 });
    const out = expander.between(from, to);
    raw = [];
    for (const e of out.events)
      raw.push([e.startDate.toJSDate(), e.endDate.toJSDate()]);
    for (const o of out.occurrences)
      raw.push([o.startDate.toJSDate(), o.endDate.toJSDate()]);
  } catch {
    return {
      ok: false,
      error: "Cet agenda n'a pas pu être lu. Réessaie, ou vérifie le lien.",
    };
  }

  // On ne garde que des créneaux valides, puis on fusionne ceux qui se
  // chevauchent (pour ne pas stocker dix fois le même moment occupé).
  const clean = raw
    .filter(
      ([s, e]) =>
        s instanceof Date &&
        e instanceof Date &&
        !isNaN(+s) &&
        !isNaN(+e) &&
        +e > +s
    )
    .sort((a, b) => +a[0] - +b[0]);

  const merged: [Date, Date][] = [];
  for (const [s, e] of clean) {
    const last = merged[merged.length - 1];
    if (last && +s <= +last[1]) {
      if (+e > +last[1]) last[1] = e;
    } else {
      merged.push([s, e]);
    }
  }

  return { ok: true, slots: merged.slice(0, MAX_SLOTS) };
}

// Rafraîchit les créneaux d'une personne dans la base : remplace les anciens
// par les nouveaux. Réservé au serveur (client admin / service_role) car la
// table busy_slots n'accepte aucune écriture depuis le navigateur.
export async function syncUserCalendar(
  admin: SupabaseClient,
  userId: string,
  url: string
): Promise<SyncResult> {
  const result = await fetchBusySlots(url);
  const nowIso = new Date().toISOString();

  if (!result.ok) {
    await admin
      .from("calendar_sources")
      .update({ last_error: result.error, last_synced_at: nowIso })
      .eq("user_id", userId);
    return result;
  }

  await admin.from("busy_slots").delete().eq("user_id", userId);

  if (result.slots.length > 0) {
    const rows = result.slots.map(([s, e]) => ({
      user_id: userId,
      starts_at: s.toISOString(),
      ends_at: e.toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("busy_slots")
        .insert(rows.slice(i, i + 500));
      if (error)
        return {
          ok: false,
          error: "L'enregistrement des créneaux a échoué.",
        };
    }
  }

  await admin
    .from("calendar_sources")
    .update({ last_error: null, last_synced_at: nowIso })
    .eq("user_id", userId);

  return { ok: true, count: result.slots.length };
}
