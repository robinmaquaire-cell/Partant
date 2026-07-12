"use client";

import { useState } from "react";
import Link from "next/link";
import { relTime } from "@/lib/rel-time";
import type { EventCardData } from "./event-card";

const pad = (n: number) => String(n).padStart(2, "0");

// Vue calendrier mensuelle : points sur les jours avec événements,
// toucher un jour affiche ses événements (reprise du prototype validé).
export function CalendarView({ events }: { events: EventCardData[] }) {
  const today = new Date();
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState<string | null>(null);

  const y = month.getFullYear();
  const m = month.getMonth();
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const keyOf = (d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const byDay = new Map<string, EventCardData[]>();
  for (const e of events) {
    const list = byDay.get(e.event_date) ?? [];
    list.push(e);
    byDay.set(e.event_date, list);
  }

  const monthLabel = month.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const dayEvents = selected ? (byDay.get(selected) ?? []) : [];

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
        <div className="font-extrabold capitalize font-display">{monthLabel}</div>
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
          const k = keyOf(d);
          const evts = byDay.get(k) ?? [];
          const isSel = selected === k;
          const isToday = k === todayKey;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(isSel ? null : k)}
              className={`rounded-xl py-2 flex flex-col items-center border-[1.5px] ${
                isSel ? "bg-ink text-paper" : "bg-card text-ink"
              } ${isToday ? "border-signal" : "border-line"}`}
            >
              <span className="text-sm font-semibold">{d}</span>
              <span className="flex gap-0.5 mt-0.5 min-h-[6px]">
                {evts.slice(0, 3).map((e, j) => (
                  <span
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSel ? "bg-signal" : "bg-river"
                    }`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {selected && dayEvents.length === 0 && (
          <p className="text-sm text-center text-ink-soft">Rien ce jour-là.</p>
        )}
        {dayEvents.map((ev) => (
          <Link
            key={ev.id}
            href={`/evenements/${ev.id}`}
            className="rounded-xl px-4 py-3 mb-2 flex justify-between items-center bg-card border-[1.5px] border-line"
          >
            <div>
              <div className="font-semibold text-sm">{ev.title}</div>
              <div className="text-xs text-ink-soft">
                {ev.event_time.slice(0, 5)}
                {ev.location_text ? ` · ${ev.location_text}` : ""}
              </div>
            </div>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
              style={{
                background: "#FF6B351A",
                color: "#FF6B35",
                border: "1px solid #FF6B3540",
              }}
              suppressHydrationWarning
            >
              {relTime(ev.event_date)}
            </span>
          </Link>
        ))}
        {!selected && (
          <p className="text-sm text-center text-ink-soft">
            Touche un jour pour voir ses événements.
          </p>
        )}
      </div>
    </div>
  );
}
