"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Convertit une heure murale de Paris (date + HH:MM) en instant UTC.
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

function parisToUtc(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = parisOffsetMinutes(new Date(guess));
  return new Date(guess - off * 60000).toISOString();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; error: string };

// ——— Créneau ponctuel : ajouter (avec support « journée entière ») ———
export async function addManualBusySlot(
  date: string,
  startTime: string,
  endTime: string,
  note: string,
  allDay: boolean
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!DATE_RE.test(date))
    return { ok: false, error: "Date invalide." };
  if (!allDay && (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)))
    return { ok: false, error: "Heures invalides." };
  if (!allDay && endTime <= startTime)
    return { ok: false, error: "L'heure de fin doit être après le début." };
  if (note.length > 120)
    return { ok: false, error: "La note est trop longue (120 caractères max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const starts = parisToUtc(date, allDay ? "00:00" : startTime);
  // Pour une journée entière, la fin est minuit du lendemain (fuseau Paris).
  const endDate = allDay
    ? (() => {
        const [y, mo, d] = date.split("-").map(Number);
        const next = new Date(Date.UTC(y, mo - 1, d + 1));
        const yyyy = next.getUTCFullYear();
        const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(next.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      })()
    : date;
  const ends = parisToUtc(endDate, allDay ? "00:00" : endTime);

  const { data, error } = await supabase.rpc("add_manual_busy_slot", {
    p_starts: starts,
    p_ends: ends,
    p_note: note.trim() || null,
  });
  if (error || data == null)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  // Note : all_day est stocké mais l'insert direct via RPC ne le passe pas.
  // On met à jour la ligne juste après (ceinture-bretelle).
  if (allDay) {
    await supabase
      .from("manual_busy_slots")
      .update({ all_day: true })
      .eq("id", data);
  }

  revalidatePath("/calendrier");
  return { ok: true, id: String(data) };
}

export async function removeManualBusySlot(id: string): Promise<Result> {
  if (!/^\d+$/.test(id)) return { ok: false, error: "Requête invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("remove_manual_busy_slot", {
    p_id: Number(id),
  });
  if (error)
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}

// ——— Règle récurrente ———
export async function addRecurringBusyRule(input: {
  weekdays: number[]; // 0 = lundi, … 6 = dimanche
  allDay: boolean;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string | null;
  note: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { weekdays, allDay, startTime, endTime, startsOn, endsOn, note } = input;
  if (!Array.isArray(weekdays) || weekdays.length === 0)
    return { ok: false, error: "Choisis au moins un jour de la semaine." };
  if (weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    return { ok: false, error: "Jour invalide." };
  if (!DATE_RE.test(startsOn))
    return { ok: false, error: "Date de début invalide." };
  if (endsOn !== null && !DATE_RE.test(endsOn))
    return { ok: false, error: "Date de fin invalide." };
  if (!allDay && (!TIME_RE.test(startTime) || !TIME_RE.test(endTime) || endTime <= startTime))
    return { ok: false, error: "Heures invalides." };
  if (note.length > 120)
    return { ok: false, error: "La note est trop longue (120 caractères max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { data, error } = await supabase.rpc("add_recurring_busy_rule", {
    p_weekdays: weekdays,
    p_all_day: allDay,
    p_start_time: allDay ? null : startTime,
    p_end_time: allDay ? null : endTime,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_note: note.trim() || null,
  });
  if (error || data == null)
    return {
      ok: false,
      error: error?.message?.endsWith(".")
        ? error.message
        : "La création a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/calendrier");
  return { ok: true, id: String(data) };
}

export async function removeRecurringBusyRule(id: string): Promise<Result> {
  if (!/^\d+$/.test(id)) return { ok: false, error: "Requête invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("remove_recurring_busy_rule", {
    p_id: Number(id),
  });
  if (error)
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true };
}

// ——— Partage granulaire ———
export type ShareMode = "none" | "everyone" | "custom";

export async function setBusyShareMode(
  mode: ShareMode,
  contactIds: string[],
  groupIds: string[]
): Promise<Result> {
  if (mode !== "none" && mode !== "everyone" && mode !== "custom")
    return { ok: false, error: "Mode invalide." };
  if (contactIds.some((id) => !UUID_RE.test(id)))
    return { ok: false, error: "Contact invalide." };
  if (groupIds.some((id) => !UUID_RE.test(id)))
    return { ok: false, error: "Groupe invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const { error } = await supabase.rpc("set_busy_share_mode", {
    p_mode: mode,
    p_contact_ids: mode === "custom" ? contactIds : [],
    p_group_ids: mode === "custom" ? groupIds : [],
  });
  if (error)
    return {
      ok: false,
      error: "L'enregistrement a échoué. Réessaie dans un instant.",
    };

  revalidatePath("/calendrier");
  return { ok: true };
}
