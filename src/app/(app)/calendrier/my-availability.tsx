"use client";

import { useMemo, useState, useTransition } from "react";
import { addManualBusySlot, removeManualBusySlot } from "./availability-actions";

export type AvailSlot = {
  source: "ics" | "partant" | "manual";
  slotId: string | null;
  startsAt: string; // ISO
  endsAt: string;
  label: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

// Découpe : matin (6-12), après-midi (12-18), soir (18-24). On considère
// un jour occupé sur un segment si au moins un créneau chevauche.
const SEGMENTS = [
  [6, 12],
  [12, 18],
  [18, 24],
] as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slotsForDay(
  slots: AvailSlot[],
  day: Date
): { seg: readonly [number, number]; busy: boolean; slots: AvailSlot[] }[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  dayEnd.setHours(0, 0, 0, 0);
  const daySlots = slots.filter((s) => {
    const st = new Date(s.startsAt);
    const en = new Date(s.endsAt);
    return en > dayStart && st < dayEnd;
  });
  return SEGMENTS.map((seg) => {
    const [h1, h2] = seg;
    const a = new Date(day);
    a.setHours(h1, 0, 0, 0);
    const b = new Date(day);
    b.setHours(h2, 0, 0, 0);
    const overlap = daySlots.filter((s) => {
      const st = new Date(s.startsAt);
      const en = new Date(s.endsAt);
      return en > a && st < b;
    });
    return { seg, busy: overlap.length > 0, slots: overlap };
  });
}

const sourceBadge: Record<AvailSlot["source"], { icon: string; text: string; cls: string }> = {
  ics: { icon: "📅", text: "Agenda", cls: "bg-sand text-ink-soft" },
  partant: { icon: "🎉", text: "Partants ?", cls: "bg-signal/15 text-signal" },
  manual: { icon: "🚫", text: "Ajouté", cls: "bg-refuse/10 text-refuse" },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MyAvailability({ initialSlots }: { initialSlots: AvailSlot[] }) {
  const today = new Date();
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState<string | null>(dayKey(today));
  const [slots, setSlots] = useState<AvailSlot[]>(initialSlots);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Formulaire d'ajout d'un créneau manuel.
  const [note, setNote] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const y = month.getFullYear();
  const m = month.getMonth();
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = dayKey(today);
  const monthLabel = month.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedDay = useMemo(() => {
    if (!selected) return null;
    const [yy, mm, dd] = selected.split("-").map(Number);
    return new Date(yy, mm - 1, dd);
  }, [selected]);

  const selectedSlots = useMemo(() => {
    if (!selectedDay) return [] as AvailSlot[];
    const start = new Date(selectedDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return slots
      .filter((s) => {
        const st = new Date(s.startsAt);
        const en = new Date(s.endsAt);
        return en > start && st < end;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [selectedDay, slots]);

  const saveManual = () =>
    startTransition(async () => {
      if (!selected) return;
      setMsg(null);
      const result = await addManualBusySlot(selected, startTime, endTime, note);
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        return;
      }
      // On l'ajoute à l'état local avec le vrai id renvoyé par le serveur,
      // pour que la suppression fonctionne dans la foulée sans re-fetch.
      const dayStartLocal = new Date(`${selected}T${startTime}`);
      const dayEndLocal = new Date(`${selected}T${endTime}`);
      setSlots((prev) => [
        ...prev,
        {
          source: "manual",
          slotId: result.id,
          startsAt: dayStartLocal.toISOString(),
          endsAt: dayEndLocal.toISOString(),
          label: note.trim() || null,
        },
      ]);
      setNote("");
      setAdding(false);
      setMsg({ ok: true, text: "Créneau enregistré ✓" });
    });

  const remove = (s: AvailSlot) => {
    if (s.source !== "manual" || !s.slotId) return;
    startTransition(async () => {
      setMsg(null);
      const result = await removeManualBusySlot(s.slotId!);
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        return;
      }
      setSlots((prev) => prev.filter((x) => x.slotId !== s.slotId));
      setMsg({ ok: true, text: "Créneau retiré." });
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(new Date(y, m - 1, 1))}
          className="px-4 py-1 text-xl font-bold text-ink-soft"
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <div className="font-extrabold capitalize font-display">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => setMonth(new Date(y, m + 1, 1))}
          className="px-4 py-1 text-xl font-bold text-ink-soft"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="text-xs font-bold py-1 text-ink-soft">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const k = `${y}-${pad(m + 1)}-${pad(d)}`;
          const isSel = selected === k;
          const isToday = k === todayKey;
          const segs = slotsForDay(slots, new Date(y, m, d));
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelected(k);
                setAdding(false);
                setMsg(null);
              }}
              className={`rounded-xl py-1.5 flex flex-col items-center border-[1.5px] ${
                isSel ? "bg-ink text-paper" : "bg-card text-ink"
              } ${isToday ? "border-signal" : "border-line"}`}
            >
              <span className="text-sm font-semibold">{d}</span>
              <div className="flex gap-0.5 mt-1 px-1 w-full">
                {segs.map((s, j) => (
                  <div
                    key={j}
                    className={`flex-1 h-1.5 rounded-sm ${
                      s.busy
                        ? isSel
                          ? "bg-refuse/70"
                          : "bg-refuse"
                        : isSel
                          ? "bg-white/20"
                          : "bg-ok/25"
                    }`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-refuse" />{" "}
          Occupé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ok/25" />{" "}
          Libre
        </span>
        <span className="ml-auto">Matin · Aprèm · Soir</span>
      </div>

      {msg && (
        <p
          className={`text-sm font-semibold mt-3 ${
            msg.ok ? "text-ok" : "text-refuse"
          }`}
        >
          {msg.text}
        </p>
      )}

      {selectedDay && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-sm">
              {selectedDay.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-xs font-bold px-2 py-1 rounded-lg bg-signal text-white"
              >
                + Créneau occupé
              </button>
            )}
          </div>

          {selectedSlots.length === 0 && !adding && (
            <p className="text-sm text-ink-soft">
              Rien de prévu — journée libre.
            </p>
          )}

          {selectedSlots.map((s) => {
            const b = sourceBadge[s.source];
            return (
              <div
                key={s.slotId ?? `${s.source}-${s.startsAt}`}
                className="rounded-xl px-3 py-2 mb-1.5 flex items-center gap-2 bg-card border-[1.5px] border-line"
              >
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${b.cls}`}
                >
                  {b.icon} {b.text}
                </span>
                <span className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {s.label ??
                      (s.source === "ics" ? "Occupé" : "Créneau occupé")}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {timeLabel(s.startsAt)} – {timeLabel(s.endsAt)}
                  </div>
                </span>
                {s.source === "manual" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(s)}
                    className="text-xs font-bold text-refuse px-2 disabled:opacity-60"
                    aria-label="Retirer ce créneau"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {adding && (
            <div className="rounded-2xl p-3 mt-2 bg-card border-[1.5px] border-line">
              <div className="flex gap-2 mb-2">
                <label className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
                    Début
                  </div>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river"
                  />
                </label>
                <label className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
                    Fin
                  </div>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river"
                  />
                </label>
              </div>
              <label className="block mb-2">
                <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
                  Note (facultatif)
                </div>
                <input
                  type="text"
                  maxLength={120}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river"
                  placeholder="ex. WE en famille"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setMsg(null);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveManual}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-white bg-signal disabled:opacity-60"
                >
                  {pending ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
