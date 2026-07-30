"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  checkAvailability,
  contactGrid,
  type Availability,
} from "./availability-actions";

export type ContactOption = { id: string; pseudo: string; avatarUrl: string | null };

const lettres = ["D", "L", "M", "M", "J", "V", "S"];

// Petite grille 7 jours (la veille + 6 jours) centrée sur la date de
// l'événement, matin / aprem / soir occupé (rouge) ou libre (vert).
function Grid({ date, slots }: { date: string; slots: { start: string; end: string }[] }) {
  const parsed = slots.map((s) => [new Date(s.start), new Date(s.end)] as const);
  const [y, mo, d] = date.split("-").map(Number);
  const start = new Date(y, mo - 1, d);
  start.setDate(start.getDate() - 1);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const isEventDay = day.getDate() === d && day.getMonth() === mo - 1;
    const segs = ([[6, 12], [12, 18], [18, 24]] as const).map(([h1, h2]) => {
      const a = new Date(day);
      a.setHours(h1, 0, 0, 0);
      const b = new Date(day);
      b.setHours(h2, 0, 0, 0);
      return parsed.some(([s, e]) => e > a && s < b);
    });
    return { day, isEventDay, segs };
  });

  return (
    <div className="flex gap-1.5 mt-2">
      {days.map(({ day, isEventDay, segs }, i) => (
        <div
          key={i}
          className={`flex-1 text-center rounded-lg py-1 ${
            isEventDay ? "bg-signal/10 ring-1 ring-signal/50" : ""
          }`}
        >
          <div className="text-[11px] font-bold text-ink-soft">
            {lettres[day.getDay()]}
          </div>
          <div className="text-xs font-bold mb-1">{day.getDate()}</div>
          <div className="flex flex-col gap-0.5 px-1">
            {segs.map((busy, j) => (
              <div
                key={j}
                className={`h-2 rounded-sm ${busy ? "bg-refuse" : "bg-ok/30"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const badge: Record<Availability, { text: string; cls: string }> = {
  busy: { text: "Pas dispo", cls: "bg-refuse/10 text-refuse" },
  free: { text: "Dispo ✓", cls: "bg-ok/15 text-ok" },
  unknown: { text: "Agenda non partagé", cls: "bg-sand text-ink-soft" },
};

export function ContactAvailability({
  contacts,
  date,
  time,
}: {
  contacts: ContactOption[];
  date: string;
  time: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, Availability> | null>(null);
  // Créneau pour lequel les résultats ont été calculés : si la date/heure
  // change ensuite, la réponse est « périmée » et on invite à revérifier.
  const [checkedFor, setCheckedFor] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const [gridFor, setGridFor] = useState<string | null>(null);
  const [grid, setGrid] = useState<{ start: string; end: string }[]>([]);
  const [gridBusy, startGridTransition] = useTransition();

  const stale = results !== null && checkedFor !== `${date} ${time}`;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const check = () =>
    startTransition(async () => {
      setErr("");
      setGridFor(null);
      const r = await checkAvailability(date, time, [...selected]);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setResults(r.results);
      setCheckedFor(`${date} ${time}`);
    });

  const openGrid = (id: string) => {
    if (gridFor === id) {
      setGridFor(null);
      return;
    }
    setGridFor(id);
    setGrid([]);
    startGridTransition(async () => {
      const r = await contactGrid(id, date);
      if (r.ok) setGrid(r.slots);
    });
  };

  if (contacts.length === 0) return null;

  return (
    <div className="rounded-2xl p-3 mb-3 bg-card border-[1.5px] border-line">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-bold text-pine"
        >
          👥 Qui est dispo ? (facultatif)
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold">👥 Disponibilité des contacts</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-ink-soft"
            >
              Masquer
            </button>
          </div>

          {!date ? (
            <p className="text-xs text-ink-soft">
              Choisis d&apos;abord une date (tout en haut) pour vérifier qui est
              disponible.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-soft mb-2">
                Coche des contacts, puis vérifie s&apos;ils sont libres au
                créneau. Tu ne vois qu&apos;occupé ou libre, jamais le détail.
              </p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {contacts.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-sm font-semibold border-[1.5px] ${
                        on ? "bg-pine/10 border-pine text-pine" : "border-line text-ink-soft"
                      }`}
                    >
                      <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={22} />
                      {c.pseudo} {on ? "✓" : ""}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={check}
                disabled={pending || selected.size === 0}
                className="px-3 py-2 rounded-xl text-sm font-bold text-white bg-pine disabled:opacity-60"
              >
                {pending ? "Vérification…" : "Vérifier les disponibilités"}
              </button>
              {err && (
                <p className="text-xs mt-2 font-semibold text-refuse">{err}</p>
              )}

              {stale && (
                <p className="text-xs mt-2 font-semibold text-signal">
                  Tu as changé la date ou l&apos;heure — revérifie pour mettre à
                  jour les disponibilités.
                </p>
              )}

              {results && !stale && (
                <div className="mt-3 space-y-1.5">
                  {contacts
                    .filter((c) => selected.has(c.id))
                    .map((c) => {
                      const status = results[c.id] ?? "unknown";
                      const b = badge[status];
                      return (
                        <div key={c.id}>
                          <div className="flex items-center gap-2">
                            <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={26} />
                            <span className="text-sm font-semibold flex-1 truncate">
                              {c.pseudo}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.cls}`}
                            >
                              {b.text}
                            </span>
                            {status !== "unknown" && (
                              <button
                                type="button"
                                onClick={() => openGrid(c.id)}
                                className="text-xs font-bold text-river"
                              >
                                {gridFor === c.id ? "masquer" : "sa grille"}
                              </button>
                            )}
                          </div>
                          {gridFor === c.id && (
                            <div className="pl-8">
                              {gridBusy ? (
                                <p className="text-xs text-ink-soft mt-1">…</p>
                              ) : (
                                <Grid date={date} slots={grid} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
