"use client";

import { useState, useTransition } from "react";
import { resetCalendarToken, setListInCalendar } from "./actions";

type ListChoice = {
  id: string;
  name: string;
  color: string;
  inCalendar: boolean;
};

// « Mon calendrier » : une URL secrète à coller dans Google Agenda ou
// Apple Calendrier, alimentée par les listes que l'on choisit.
export function CalendarSection({
  url,
  lists,
}: {
  url: string;
  lists: ListChoice[];
}) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [help, setHelp] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErr("Copie impossible — sélectionne le lien et copie-le à la main.");
    }
  };

  const toggle = (list: ListChoice) =>
    startTransition(async () => {
      setErr("");
      const result = await setListInCalendar(list.id, !list.inCalendar);
      if (!result.ok) setErr(result.error);
    });

  const reset = () =>
    startTransition(async () => {
      setErr("");
      const result = await resetCalendarToken();
      if (!result.ok) setErr(result.error);
      setConfirmReset(false);
    });

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <h3 className="font-extrabold mb-1 font-display">
        📅 Mon calendrier partagé
      </h3>
      <p className="text-sm mb-3 text-ink-soft">
        Ajoute ce lien dans Google Agenda (ou Apple Calendrier) et tes
        événements « Partant ? » y apparaîtront automatiquement.
      </p>

      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-paper border-[1.5px] border-line rounded-xl px-3 py-2.5 text-xs text-ink-soft outline-none mb-2"
        aria-label="Adresse de mon calendrier"
      />
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={copy}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
        >
          {copied ? "Lien copié ✓" : "Copier le lien"}
        </button>
        <button
          type="button"
          onClick={() => setHelp(!help)}
          className="px-4 py-2.5 rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
        >
          {help ? "Masquer" : "Comment faire ?"}
        </button>
      </div>

      {help && (
        <div className="rounded-xl p-3 mb-3 bg-paper text-sm">
          <div className="font-bold mb-1">Sur ordinateur, dans Google Agenda</div>
          <ol className="list-decimal ml-5 space-y-1 text-ink-soft">
            <li>Copie le lien ci-dessus.</li>
            <li>
              Ouvre <span className="font-semibold">calendar.google.com</span>.
            </li>
            <li>
              À gauche, à côté de{" "}
              <span className="font-semibold">Autres agendas</span>, clique sur
              le <span className="font-semibold">+</span>.
            </li>
            <li>
              Choisis{" "}
              <span className="font-semibold">À partir de l&apos;URL</span>.
            </li>
            <li>Colle le lien, puis « Ajouter un agenda ».</li>
          </ol>
          <p className="mt-2 text-ink-soft">
            Sur iPhone : Réglages → Applications → Calendrier → Comptes →
            Ajouter un compte → Autre → Ajouter un abonnement à un calendrier.
          </p>
          <p className="mt-2 text-ink-soft">
            ⏳ Google ne relit ce lien que toutes les quelques heures (parfois
            jusqu&apos;à 24 h) : un nouvel événement peut mettre un moment à
            apparaître dans ton agenda. C&apos;est une limite de Google, pas de
            l&apos;app — l&apos;app, elle, est toujours à jour.
          </p>
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wide mb-2 text-ink-soft">
        Listes envoyées dans mon calendrier
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
          onClick={() => toggle(l)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl mb-1 text-sm font-semibold text-left text-ink border-[1.5px] disabled:opacity-60"
          style={{
            background: l.inCalendar ? l.color + "1A" : "#FFFFFF",
            borderColor: l.inCalendar ? l.color : "#DCE6E2",
          }}
        >
          <span className="text-lg leading-none">
            {l.inCalendar ? "☑" : "☐"}
          </span>
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: l.color }}
          />
          {l.name}
        </button>
      ))}

      <p className="text-xs mt-2 text-ink-soft">
        Les événements auxquels tu as répondu « Pas dispo » n&apos;apparaissent
        pas dans ton agenda.
      </p>

      {confirmReset ? (
        <div className="rounded-xl p-3 mt-3 bg-refuse/10 border-[1.5px] border-refuse/40">
          <p className="text-sm font-semibold mb-2">
            Changer de lien ? L&apos;ancien cessera de fonctionner : il faudra
            réajouter le nouveau dans ton agenda.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={reset}
              className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-refuse disabled:opacity-60"
            >
              Oui, changer
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="text-xs underline mt-2 text-ink-soft"
        >
          Ce lien ne doit pas être partagé — le remplacer
        </button>
      )}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
