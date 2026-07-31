"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addManualBusySlot,
  addRecurringBusyRule,
  removeManualBusySlot,
  removeRecurringBusyRule,
} from "./availability-actions";

export type AvailSlot = {
  source: "ics" | "partant" | "manual";
  slotId: string | null; // « r-<id> » pour les occurrences de règle
  startsAt: string; // ISO
  endsAt: string;
  label: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

// Découpe : matin (6-12), après-midi (12-18), soir (18-24). Un segment
// s'affiche rouge si au moins un créneau le chevauche.
const SEGMENTS = [
  [6, 12],
  [12, 18],
  [18, 24],
] as const;

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slotsForDay(
  slots: AvailSlot[],
  day: Date
): { seg: readonly [number, number]; busy: boolean }[] {
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
    const busy = daySlots.some((s) => {
      const st = new Date(s.startsAt);
      const en = new Date(s.endsAt);
      return en > a && st < b;
    });
    return { seg, busy };
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

function isAllDay(s: AvailSlot): boolean {
  const st = new Date(s.startsAt);
  const en = new Date(s.endsAt);
  // ~24 h et démarre à minuit (Paris).
  const durH = (en.getTime() - st.getTime()) / 3600000;
  return durH >= 23.5 && st.getHours() === 0 && st.getMinutes() === 0;
}

function isRecurringSlot(s: AvailSlot): boolean {
  return !!s.slotId && s.slotId.startsWith("r-");
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

  // Formulaire d'ajout.
  const [note, setNote] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [allDay, setAllDay] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [endsOn, setEndsOn] = useState("");

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

  const resetForm = () => {
    setNote("");
    setStartTime("09:00");
    setEndTime("18:00");
    setAllDay(false);
    setRecurring(false);
    setWeekdays(new Set());
    setEndsOn("");
    setAdding(false);
  };

  const toggleWeekday = (i: number) =>
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const saveSlot = () =>
    startTransition(async () => {
      if (!selected) return;
      setMsg(null);
      if (recurring) {
        // Règle récurrente : pré-cocher le jour de la date sélectionnée
        // si aucun jour n'est coché — arrangement gentil pour l'utilisateur.
        const dayIsoIndex = (new Date(selected).getDay() + 6) % 7;
        const wd = weekdays.size === 0 ? [dayIsoIndex] : [...weekdays];
        const result = await addRecurringBusyRule({
          weekdays: wd,
          allDay,
          startTime,
          endTime,
          startsOn: selected,
          endsOn: endsOn || null,
          note,
        });
        if (!result.ok) {
          setMsg({ ok: false, text: result.error });
          return;
        }
        // Le rendu du serveur est nécessaire pour voir les nouvelles
        // occurrences réparties sur toutes les dates : on rafraîchit.
        resetForm();
        setMsg({ ok: true, text: "Règle enregistrée ✓" });
        // Recharger la page pour re-fetcher les slots (règles expandues).
        window.location.reload();
        return;
      }
      // Créneau ponctuel.
      const result = await addManualBusySlot(
        selected,
        startTime,
        endTime,
        note,
        allDay
      );
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        return;
      }
      const dayStartLocal = new Date(
        `${selected}T${allDay ? "00:00" : startTime}`
      );
      const dayEndLocal = allDay
        ? (() => {
            const d = new Date(dayStartLocal);
            d.setDate(d.getDate() + 1);
            return d;
          })()
        : new Date(`${selected}T${endTime}`);
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
      resetForm();
      setMsg({ ok: true, text: "Créneau enregistré ✓" });
    });

  const remove = (s: AvailSlot) => {
    if (s.source !== "manual" || !s.slotId) return;
    const isRule = isRecurringSlot(s);
    if (isRule) {
      if (
        !window.confirm(
          "Supprimer toutes les occurrences de cette règle récurrente ?"
        )
      )
        return;
    }
    startTransition(async () => {
      setMsg(null);
      const bareId = isRule ? s.slotId!.slice(2) : s.slotId!;
      const result = isRule
        ? await removeRecurringBusyRule(bareId)
        : await removeManualBusySlot(bareId);
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        return;
      }
      if (isRule) {
        // Supprimer toutes les occurrences de la règle localement.
        setSlots((prev) => prev.filter((x) => x.slotId !== s.slotId));
      } else {
        setSlots((prev) => prev.filter((x) => x.slotId !== s.slotId));
      }
      setMsg({ ok: true, text: isRule ? "Règle retirée." : "Créneau retiré." });
    });
  };

  const input =
    "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river";
  const label = "text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft";

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
        {WEEKDAY_LABELS.map((d, i) => (
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
                resetForm();
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
            const isRule = isRecurringSlot(s);
            const wholeDay = isAllDay(s);
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
                    {isRule && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pine/10 text-pine align-middle">
                        ↻ récurrent
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {wholeDay
                      ? "Journée entière"
                      : `${timeLabel(s.startsAt)} – ${timeLabel(s.endsAt)}`}
                  </div>
                </span>
                {s.source === "manual" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(s)}
                    className="text-xs font-bold text-refuse px-2 disabled:opacity-60"
                    aria-label={
                      isRule
                        ? "Retirer cette règle récurrente"
                        : "Retirer ce créneau"
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {adding && (
            <div className="rounded-2xl p-3 mt-2 bg-card border-[1.5px] border-line">
              <label className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                Journée entière
              </label>
              {!allDay && (
                <div className="flex gap-2 mb-2">
                  <label className="flex-1">
                    <div className={label}>Début</div>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={input}
                    />
                  </label>
                  <label className="flex-1">
                    <div className={label}>Fin</div>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={input}
                    />
                  </label>
                </div>
              )}
              <label className="block mb-2">
                <div className={label}>Note (facultatif)</div>
                <input
                  type="text"
                  maxLength={120}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={input}
                  placeholder="ex. WE en famille"
                />
              </label>

              <label className="flex items-center gap-2 mt-3 mb-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                ↻ Répéter chaque semaine
              </label>
              {recurring && (
                <div className="pl-6 border-l-2 border-line ml-1 mb-2">
                  <div className={label}>Jours de la semaine</div>
                  <div className="flex gap-1 mb-2">
                    {WEEKDAY_LABELS.map((d, i) => {
                      const on = weekdays.has(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleWeekday(i)}
                          className={`w-8 h-8 rounded-full text-xs font-bold border-[1.5px] ${
                            on
                              ? "bg-ink text-paper border-ink"
                              : "text-ink-soft border-line"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-ink-soft mb-2">
                    Rien de coché ? On répète chaque semaine le jour de la
                    date choisie.
                  </p>
                  <label className="block">
                    <div className={label}>Jusqu&apos;au (facultatif)</div>
                    <input
                      type="date"
                      value={endsOn}
                      onChange={(e) => setEndsOn(e.target.value)}
                      className={input}
                      min={selected ?? undefined}
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMsg(null);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveSlot}
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
