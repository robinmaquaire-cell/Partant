"use client";

import { useState } from "react";
import { CalendarView } from "@/components/calendar-view";
import { EventsMap } from "@/components/events-map";
import type { EventCardData } from "@/components/event-card";

// « Mon calendrier » avec bascule entre la vue calendrier (mois) et la
// vue carte (les événements géolocalisés).
export function MyCalendar({ events }: { events: EventCardData[] }) {
  const [view, setView] = useState<"cal" | "map">("cal");

  const tab = (active: boolean) =>
    `flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
      active ? "bg-ink text-paper" : "text-ink-soft"
    }`;

  return (
    <div>
      <div className="flex gap-1 p-1 mb-3 rounded-2xl bg-card border-[1.5px] border-line">
        <button
          type="button"
          onClick={() => setView("cal")}
          className={tab(view === "cal")}
        >
          🗓 Calendrier
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={tab(view === "map")}
        >
          🗺️ Carte
        </button>
      </div>

      {view === "cal" ? (
        <CalendarView events={events} />
      ) : (
        <EventsMap events={events} />
      )}
    </div>
  );
}
