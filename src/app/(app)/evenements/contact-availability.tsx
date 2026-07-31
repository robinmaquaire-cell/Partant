"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  checkAvailability,
  contactGrid,
  type Availability,
} from "./availability-actions";

export type ContactOption = { id: string; pseudo: string; avatarUrl: string | null };

const lettres = ["D", "L", "M", "M", "J", "V", "S"];

// Grille 7 jours (la veille + 6 jours) centrée sur la date de l'événement,
// matin / aprem / soir occupé (rouge) ou libre (vert).
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

// Petite pastille colorée qui résume la dispo.
function Pill({ status, loading }: { status: Availability; loading: boolean }) {
  if (loading)
    return (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sand text-ink-soft">
        …
      </span>
    );
  const map: Record<Availability, { text: string; cls: string }> = {
    busy: { text: "Pas dispo", cls: "bg-refuse/10 text-refuse" },
    free: { text: "Dispo ✓", cls: "bg-ok/15 text-ok" },
    unknown: { text: "Inconnu", cls: "bg-sand text-ink-soft" },
  };
  const b = map[status];
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${b.cls}`}>
      {b.text}
    </span>
  );
}

export function ContactAvailability({
  contacts,
  date,
  time,
  invitedIds,
  onInvitedChange,
}: {
  contacts: ContactOption[];
  date: string;
  time: string;
  invitedIds: string[]; // état porté par le formulaire parent
  onInvitedChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Record<string, Availability>>({});
  // Créneau pour lequel les résultats ont été calculés.
  const [checkedFor, setCheckedFor] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const [gridFor, setGridFor] = useState<string | null>(null);
  const [grid, setGrid] = useState<{ start: string; end: string }[]>([]);
  const [gridBusy, startGridTransition] = useTransition();

  const key = `${date} ${time}`;

  // Auto-charge les dispos dès que la section est ouverte et que
  // date + heure sont saisies. Se déclenche aussi quand la date/heure
  // ou la liste de contacts change.
  useEffect(() => {
    if (!open || !date || contacts.length === 0) return;
    if (checkedFor === key) return;
    startTransition(async () => {
      setErr("");
      const r = await checkAvailability(date, time, contacts.map((c) => c.id));
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setResults(r.results);
      setCheckedFor(key);
    });
  }, [open, date, time, contacts, checkedFor, key]);

  const toggleInvited = (id: string) => {
    const next = invitedIds.includes(id)
      ? invitedIds.filter((x) => x !== id)
      : [...invitedIds, id];
    onInvitedChange(next);
  };

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

  const invitedCount = invitedIds.length;

  return (
    <div className="rounded-2xl p-3 mb-3 bg-card border-[1.5px] border-line">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-bold text-pine"
        >
          <span>👥 Inviter des contacts (facultatif)</span>
          {invitedCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-signal text-white">
              {invitedCount}
            </span>
          )}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold">
              👥 Inviter des contacts
              {invitedCount > 0 && (
                <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full bg-signal text-white">
                  {invitedCount} sélectionné{invitedCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
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
              Choisis d&apos;abord une date (tout en haut) pour voir qui est
              disponible.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-soft mb-2">
                Coche les contacts à inviter. La pastille indique s&apos;ils sont
                libres au créneau ({time || "toute la journée"}). Tu ne vois
                jamais le détail de leur agenda.
              </p>

              {err && (
                <p className="text-xs mb-2 font-semibold text-refuse">{err}</p>
              )}

              <div className="rounded-xl border-[1.5px] border-line overflow-hidden">
                {contacts.map((c) => {
                  const on = invitedIds.includes(c.id);
                  const status = results[c.id] ?? "unknown";
                  return (
                    <div
                      key={c.id}
                      className="bg-card border-b-[1.5px] border-line last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleInvited(c.id)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-left"
                      >
                        <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={30} />
                        <span className="flex-1 font-semibold text-sm truncate">
                          {c.pseudo}
                        </span>
                        <Pill status={status} loading={pending && !results[c.id]} />
                        {status !== "unknown" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openGrid(c.id);
                            }}
                            className="text-xs font-bold text-river px-1"
                          >
                            {gridFor === c.id ? "×" : "📅"}
                          </button>
                        )}
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            on
                              ? "bg-signal text-white"
                              : "border-[1.5px] border-line text-ink-soft"
                          }`}
                        >
                          {on ? "✓" : "+"}
                        </span>
                      </button>
                      {gridFor === c.id && (
                        <div className="px-3 pb-2">
                          {gridBusy ? (
                            <p className="text-xs text-ink-soft">…</p>
                          ) : (
                            <Grid date={date} slots={grid} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {invitedCount > 0 && (
                <p className="text-xs mt-2 text-ink-soft">
                  Ces {invitedCount} personne{invitedCount > 1 ? "s" : ""}{" "}
                  {invitedCount > 1 ? "seront invitées" : "sera invitée"}
                  {" "}à l&apos;événement à sa création.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
