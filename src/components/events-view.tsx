"use client";

import { useState } from "react";
import Link from "next/link";
import { EventCard, type EventCardData } from "./event-card";
import { CalendarView } from "./calendar-view";

// Onglet Événements : bascule entre la vue liste (à venir) et le calendrier.
export function EventsView({ events }: { events: EventCardData[] }) {
  const [view, setView] = useState<"list" | "cal">("list");

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  const upcoming = events.filter((e) => e.event_date >= todayKey);

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold font-display">À venir</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border-[1.5px] border-line">
            {(
              [
                { id: "list", label: "☰", name: "Vue liste" },
                { id: "cal", label: "🗓", name: "Vue calendrier" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-label={v.name}
                className={`px-3 py-1.5 text-sm font-bold ${
                  view === v.id ? "bg-ink text-paper" : "bg-card text-ink-soft"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Link
            href="/evenements/nouveau"
            className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
          >
            + Événement
          </Link>
        </div>
      </div>

      {view === "cal" ? (
        <CalendarView events={events} />
      ) : (
        <>
          {upcoming.length === 0 && (
            <div className="text-center py-12 text-ink-soft">
              Aucun événement à venir. Crée le premier !
            </div>
          )}
          {upcoming.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </>
      )}
    </div>
  );
}
