"use client";

import { useState, useTransition } from "react";
import { ListLogo } from "@/components/list-logo";
import { saveSyncPrefs, setListInCalendar, type SyncPrefs } from "./actions";

export type CalendarList = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  logoUrl: string | null;
  inCalendar: boolean;
};

const NO_CATEGORY = "(sans catégorie)";

// Les règles qui décident quels événements partent dans le calendrier
// externe. Chaque changement est enregistré aussitôt.
export function SyncRules({
  lists,
  categories,
  initial,
}: {
  lists: CalendarList[];
  categories: string[]; // catégories présentes dans mes événements
  initial: SyncPrefs;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const push = (next: SyncPrefs) =>
    startTransition(async () => {
      setErr("");
      setPrefs(next);
      const result = await saveSyncPrefs(next);
      if (!result.ok) setErr(result.error);
    });

  const toggleList = (l: CalendarList) =>
    startTransition(async () => {
      setErr("");
      const result = await setListInCalendar(l.id, !l.inCalendar);
      if (!result.ok) setErr(result.error);
    });

  // Une catégorie vide représente les événements sans catégorie.
  const catOptions = [
    ...categories.map((c) => ({ value: c, label: c })),
    { value: "", label: NO_CATEGORY },
  ];
  const selected = prefs.categories;
  const toggleCategory = (value: string) => {
    const current = selected ?? catOptions.map((c) => c.value);
    const next = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    // Tout coché = pas de filtre du tout.
    push({
      ...prefs,
      categories: next.length === catOptions.length ? null : next,
    });
  };

  const toggle = (on: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1 text-sm font-semibold text-left border-[1.5px] ${
      on ? "bg-ok/10 border-ok/50 text-ink" : "bg-card border-line text-ink-soft"
    }`;

  const chip = (on: boolean) =>
    `px-3 py-1 rounded-full text-sm font-semibold border-[1.5px] ${
      on ? "bg-ink text-paper border-ink" : "bg-card text-ink-soft border-line"
    }`;

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <h3 className="font-extrabold mb-1 font-display">Que synchroniser ?</h3>
      <p className="text-sm mb-3 text-ink-soft">
        Ces règles s&apos;appliquent à tous les événements. Tu pourras ensuite
        faire des exceptions événement par événement, juste en dessous.
      </p>

      <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
        Mes listes de diffusion
      </div>
      {lists.length === 0 && (
        <p className="text-sm mb-2 text-ink-soft">
          Tu n&apos;es membre d&apos;aucune liste pour l&apos;instant.
        </p>
      )}
      {lists.map((l) => (
        <button
          key={l.id}
          type="button"
          disabled={pending}
          onClick={() => toggleList(l)}
          className={toggle(l.inCalendar)}
        >
          <span className="text-lg leading-none">
            {l.inCalendar ? "☑" : "☐"}
          </span>
          <ListLogo
            list={{
              name: l.name,
              color: l.color,
              emoji: l.emoji,
              logoUrl: l.logoUrl,
            }}
            size={22}
          />
          {l.name}
        </button>
      ))}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          push({ ...prefs, includeGuestEvents: !prefs.includeGuestEvents })
        }
        className={`${toggle(prefs.includeGuestEvents)} mt-2`}
      >
        <span className="text-lg leading-none">
          {prefs.includeGuestEvents ? "☑" : "☐"}
        </span>
        🔗 Les événements reçus par lien d&apos;invitation
      </button>

      <div className="text-xs font-bold uppercase tracking-wide mt-4 mb-1 text-ink-soft">
        Ma réponse
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => push({ ...prefs, onlyYes: !prefs.onlyYes })}
        className={toggle(prefs.onlyYes)}
      >
        <span className="text-lg leading-none">{prefs.onlyYes ? "☑" : "☐"}</span>
        Seulement ceux où j&apos;ai répondu « Partant ! »
      </button>
      <p className="text-xs text-ink-soft">
        {prefs.onlyYes
          ? "Les événements sans réponse restent hors de ton agenda."
          : "Les événements sans réponse sont aussi synchronisés (les refusés, jamais)."}
      </p>

      {categories.length > 0 && (
        <>
          <div className="text-xs font-bold uppercase tracking-wide mt-4 mb-1 text-ink-soft">
            Catégories
          </div>
          <div className="flex flex-wrap gap-2">
            {catOptions.map((c) => {
              const on = selected === null || selected.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  disabled={pending}
                  onClick={() => toggleCategory(c.value)}
                  className={chip(on)}
                >
                  {on ? "✓ " : ""}
                  {c.label}
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <button
              type="button"
              onClick={() => push({ ...prefs, categories: null })}
              className="text-xs underline mt-2 text-ink-soft"
            >
              Toutes les catégories
            </button>
          )}
        </>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mt-4 mb-1 text-ink-soft">
        Plage de dates (facultatif)
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={prefs.dateFrom ?? ""}
          onChange={(e) =>
            push({ ...prefs, dateFrom: e.target.value || null })
          }
          className="flex-1 min-w-0 bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river"
          aria-label="À partir du"
        />
        <span className="text-sm text-ink-soft">→</span>
        <input
          type="date"
          value={prefs.dateTo ?? ""}
          onChange={(e) => push({ ...prefs, dateTo: e.target.value || null })}
          className="flex-1 min-w-0 bg-card border-[1.5px] border-line rounded-xl px-3 py-2 text-[15px] text-ink outline-none focus:border-river"
          aria-label="Jusqu'au"
        />
      </div>
      {(prefs.dateFrom || prefs.dateTo) && (
        <button
          type="button"
          onClick={() => push({ ...prefs, dateFrom: null, dateTo: null })}
          className="text-xs underline mt-1 text-ink-soft"
        >
          Effacer les dates
        </button>
      )}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
