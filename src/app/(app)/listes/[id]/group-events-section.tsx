"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";

// Les événements d'un groupe, avec bascule Liste ↔ Calendrier.
export function GroupEventsSection({ events }: { events: CalendarEvent[] }) {
  const [mode, setMode] = useState<"list" | "cal">("list");

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-extrabold font-display">
          Événements du groupe
        </h3>
        {events.length > 0 && (
          <div className="flex rounded-xl border-[1.5px] border-line overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode("list")}
              className={`px-3 py-1 ${
                mode === "list" ? "bg-ink text-paper" : "text-ink-soft"
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setMode("cal")}
              className={`px-3 py-1 ${
                mode === "cal" ? "bg-ink text-paper" : "text-ink-soft"
              }`}
            >
              Calendrier
            </button>
          </div>
        )}
      </div>

      {events.length === 0 && (
        <p className="text-sm text-ink-soft">
          Aucun événement pour l&apos;instant.
        </p>
      )}

      {events.length > 0 && mode === "list" && (
        <div>
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/evenements/${ev.id}`}
              className="rounded-xl px-4 py-3 mb-2 flex justify-between items-center bg-card border-[1.5px] border-line"
            >
              <span className="font-semibold text-sm">{ev.title}</span>
              <span className="text-xs font-bold text-ink-soft">
                {new Date(ev.event_date + "T00:00").toLocaleDateString(
                  "fr-FR",
                  { day: "numeric", month: "short" }
                )}{" "}
                · {ev.event_time.slice(0, 5)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {events.length > 0 && mode === "cal" && <CalendarView events={events} />}
    </div>
  );
}
