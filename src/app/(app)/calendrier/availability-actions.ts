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

type Result = { ok: true } | { ok: false; error: string };

export async function addManualBusySlot(
  date: string,
  startTime: string,
  endTime: string,
  note: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime))
    return { ok: false, error: "Date ou heures invalides." };
  if (endTime <= startTime)
    return { ok: false, error: "L'heure de fin doit être après le début." };
  if (note.length > 120)
    return { ok: false, error: "La note est trop longue (120 caractères max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const starts = parisToUtc(date, startTime);
  const ends = parisToUtc(date, endTime);

  const { data, error } = await supabase.rpc("add_manual_busy_slot", {
    p_starts: starts,
    p_ends: ends,
    p_note: note.trim() || null,
  });
  if (error || data == null)
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath("/calendrier");
  return { ok: true, id: String(data) };
}

export async function removeManualBusySlot(
  id: string
): Promise<Result> {
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
