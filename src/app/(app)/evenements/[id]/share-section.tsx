"use client";

import { useState, useTransition } from "react";
import { regenerateShareLink } from "../actions";

// Lien de partage d'un événement : il permet de rejoindre l'événement
// même sans faire partie d'une liste de diffusion.
export function ShareSection({
  eventId,
  token,
  title,
}: {
  eventId: string;
  token: string;
  title: string;
}) {
  const [current, setCurrent] = useState(token);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = () => `${window.location.origin}/e/${current}`;

  const share = async () => {
    const link = url();
    // Sur téléphone, le partage natif (WhatsApp, SMS, e-mail…) si disponible.
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Partant ? ${title}`, url: link });
        return;
      } catch {
        // Partage annulé : on retombe sur la copie.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage(`Copie ce lien : ${link}`);
    }
  };

  const regenerate = () =>
    startTransition(async () => {
      const result = await regenerateShareLink(eventId);
      if (result.ok) {
        setCurrent(result.token);
        setMessage("Nouveau lien créé — l'ancien ne fonctionne plus.");
      } else setMessage(result.error);
      setConfirmReset(false);
    });

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={share}
        className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
      >
        {copied ? "Lien copié ✓" : "🔗 Partager cet événement"}
      </button>
      <p className="text-xs mt-1 text-center text-ink-soft">
        Ce lien permet de rejoindre l&apos;événement, même sans être dans une
        liste de diffusion (un compte se crée au passage).
      </p>

      {confirmReset ? (
        <div className="rounded-xl p-3 mt-2 bg-refuse/10 border-[1.5px] border-refuse/40">
          <p className="text-sm font-semibold mb-2">
            Créer un nouveau lien ? L&apos;ancien cessera de fonctionner (les
            personnes déjà arrivées gardent leur accès).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={regenerate}
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
          className="w-full mt-1 text-xs font-bold text-refuse underline"
        >
          Remplacer le lien de partage
        </button>
      )}

      {message && (
        <p className="text-xs mt-1 text-center font-semibold text-ink-soft break-all">
          {message}
        </p>
      )}
    </div>
  );
}
