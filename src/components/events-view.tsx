"use client";

import { useState } from "react";
import Link from "next/link";
import { EventCard, type EventCardData } from "./event-card";
import { ListLogo } from "./list-logo";

type StatusFilter = "yes" | "none" | "no" | null;

// Onglet Événements : la liste des événements à venir, filtrable par liste
// de diffusion et par ma réponse. Par défaut, les événements auxquels on a
// répondu « Pas dispo » sont masqués (filtre « Pas dispo » pour les revoir).
// La vue calendrier a sa propre page (onglet Calendrier).
export function EventsView({ events }: { events: EventCardData[] }) {
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

  // Les listes présentes dans les événements affichables, sans doublon.
  const allLists = new Map<string, EventCardData["lists"][number]>();
  for (const e of events)
    for (const l of e.lists) if (!allLists.has(l.id)) allLists.set(l.id, l);
  const listOptions = [...allLists.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr")
  );

  const refusedCount = events.filter((e) => e.myStatus === "no").length;

  const filtered = events.filter((e) => {
    if (listFilter && !e.lists.some((l) => l.id === listFilter)) return false;
    if (statusFilter === "yes" && e.myStatus !== "yes") return false;
    if (statusFilter === "none" && e.myStatus !== null) return false;
    if (statusFilter === "no" && e.myStatus !== "no") return false;
    // Sans filtre explicite, on cache ce qu'on a déjà refusé.
    if (statusFilter === null && e.myStatus === "no") return false;
    return true;
  });

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  const upcoming = filtered.filter((e) => e.event_date >= todayKey);

  const chip = (active: boolean) =>
    `shrink-0 px-3 py-1 rounded-full text-sm font-semibold border-[1.5px] transition-colors inline-flex items-center gap-1.5 ${
      active ? "bg-ink text-paper border-ink" : "bg-card text-ink-soft border-line"
    }`;

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold font-display">À venir</h2>
        <Link
          href="/evenements/nouveau"
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          + Événement
        </Link>
      </div>

      {/* Filtres : n'apparaissent que s'il y a matière à filtrer. */}
      {events.length > 0 &&
        (listOptions.length > 1 || events.length > 2 || refusedCount > 0) && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-5 px-5">
            <button
              type="button"
              onClick={() => {
                setListFilter(null);
                setStatusFilter(null);
              }}
              className={chip(listFilter === null && statusFilter === null)}
            >
              Tous
            </button>
            {listOptions.length > 1 &&
              listOptions.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setListFilter(listFilter === l.id ? null : l.id)
                  }
                  className={chip(listFilter === l.id)}
                  style={
                    listFilter === l.id
                      ? { background: l.color, borderColor: l.color }
                      : undefined
                  }
                >
                  {l.emoji || l.logoUrl ? (
                    <ListLogo list={{ ...l, logoUrl: l.logoUrl }} size={18} />
                  ) : (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        background: listFilter === l.id ? "#fff" : l.color,
                      }}
                    />
                  )}
                  {l.name}
                </button>
              ))}
            <button
              type="button"
              onClick={() =>
                setStatusFilter(statusFilter === "yes" ? null : "yes")
              }
              className={chip(statusFilter === "yes")}
            >
              Partant ✓
            </button>
            <button
              type="button"
              onClick={() =>
                setStatusFilter(statusFilter === "none" ? null : "none")
              }
              className={chip(statusFilter === "none")}
            >
              Sans réponse
            </button>
            {refusedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "no" ? null : "no")}
                className={chip(statusFilter === "no")}
              >
                Pas dispo ({refusedCount})
              </button>
            )}
          </div>
        )}

      {upcoming.length === 0 && (
        <div className="text-center py-12 text-ink-soft">
          {events.length === 0
            ? "Aucun événement à venir. Crée le premier !"
            : statusFilter === "no"
              ? "Aucun événement refusé à venir."
              : "Rien ne correspond à ces filtres."}
        </div>
      )}
      {upcoming.map((ev) => (
        <EventCard key={ev.id} ev={ev} />
      ))}
    </div>
  );
}
