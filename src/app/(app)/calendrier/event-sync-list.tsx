"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setEventSync } from "./actions";

export type SyncEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  listNames: string;
  category: string | null;
  myStatus: "yes" | "no" | null;
  synced: boolean;
  ruleOk: boolean;
  isException: boolean; // une exception a été posée sur cet événement
};

// Les événements à venir, avec la possibilité d'en forcer un dans le
// calendrier synchronisé (ou de l'en sortir), au cas par cas.
export function EventSyncList({ events }: { events: SyncEvent[] }) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr("");
      const result = await fn();
      if (!result.ok && result.error) setErr(result.error);
    });

  const toggle = (ev: SyncEvent) => {
    const wanted = !ev.synced;
    // Si le choix rejoint la règle générale, l'exception n'a plus lieu d'être.
    run(() => setEventSync(ev.id, wanted === ev.ruleOk ? null : wanted));
  };

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <h3 className="font-extrabold mb-1 font-display">Événement par événement</h3>
      <p className="text-sm mb-3 text-ink-soft">
        Coche ou décoche un événement précis : ton choix prend le pas sur les
        règles ci-dessus.
      </p>

      {events.length === 0 && (
        <p className="text-sm text-ink-soft">Aucun événement à venir.</p>
      )}

      {events.map((ev) => (
        <div
          key={ev.id}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1 border-[1.5px] border-line"
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(ev)}
            className="text-xl leading-none shrink-0 disabled:opacity-60"
            aria-label={
              ev.synced ? `Retirer ${ev.title}` : `Ajouter ${ev.title}`
            }
          >
            {ev.synced ? "☑" : "☐"}
          </button>
          <div className="flex-1 min-w-0">
            <Link
              href={`/evenements/${ev.id}`}
              className="font-semibold text-sm block truncate"
            >
              {ev.title}
            </Link>
            <div className="text-xs text-ink-soft truncate">
              {new Date(ev.date + "T00:00").toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}{" "}
              · {ev.time.slice(0, 5)}
              {ev.listNames ? ` · ${ev.listNames}` : " · 🔗 sur invitation"}
              {ev.category ? ` · 🏷 ${ev.category}` : ""}
              {ev.myStatus === "no" ? " · Pas dispo" : ""}
            </div>
          </div>
          {ev.isException && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setEventSync(ev.id, null))}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sand text-pine shrink-0"
              title="Revenir à la règle générale"
            >
              exception ✕
            </button>
          )}
        </div>
      ))}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
