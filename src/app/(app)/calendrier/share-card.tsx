"use client";

import { useState, useTransition } from "react";
import { resetCalendarToken } from "./actions";

// L'adresse secrète à coller dans Google Agenda / Apple Calendrier / Outlook.
export function ShareCard({ url }: { url: string }) {
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

  const reset = () =>
    startTransition(async () => {
      setErr("");
      const result = await resetCalendarToken();
      if (!result.ok) setErr(result.error);
      setConfirmReset(false);
    });

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <p className="text-sm mb-3 text-ink-soft">
        Colle cette adresse dans Google Agenda, Apple Calendrier ou Outlook :
        les événements cochés plus bas y apparaîtront tout seuls.
      </p>

      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-paper border-[1.5px] border-line rounded-xl px-3 py-2.5 text-xs text-ink-soft outline-none mb-2"
        aria-label="Adresse de mon calendrier"
      />
      <div className="flex gap-2">
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
        <div className="rounded-xl p-3 mt-3 bg-paper text-sm">
          <div className="font-bold mb-1">Google Agenda (sur ordinateur)</div>
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
          <div className="font-bold mt-2 mb-1">Outlook</div>
          <p className="text-ink-soft">
            Calendrier → Ajouter un calendrier → S&apos;abonner à partir du web
            → colle le lien.
          </p>
          <div className="font-bold mt-2 mb-1">iPhone</div>
          <p className="text-ink-soft">
            Réglages → Applications → Calendrier → Comptes → Ajouter un compte →
            Autre → Ajouter un abonnement à un calendrier.
          </p>
          <p className="mt-2 text-ink-soft">
            ⏳ Google ne relit ce lien que toutes les quelques heures (parfois
            jusqu&apos;à 24 h) : un nouvel événement peut mettre un moment à
            apparaître. C&apos;est une limite de Google, pas de
            l&apos;application.
          </p>
        </div>
      )}

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
