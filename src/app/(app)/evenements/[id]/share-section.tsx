"use client";

import { useState, useTransition } from "react";
import { regenerateShareLink } from "../actions";

// Gestion du lien de partage, réservée aux organisateurs. Le partage
// lui-même se fait avec le bouton « 🔗 Partager » en haut de la page.
export function ShareSection({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  const regenerate = () =>
    startTransition(async () => {
      const result = await regenerateShareLink(eventId);
      setMessage(
        result.ok
          ? "Nouveau lien créé — l'ancien ne fonctionne plus."
          : result.error
      );
      setConfirmReset(false);
    });

  return (
    <div className="mb-4">
      <p className="text-xs text-ink-soft">
        🔗 Le bouton « Partager » en haut envoie un lien qui permet de
        rejoindre l&apos;événement, même sans être dans une liste de diffusion
        (le compte se crée au passage).
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
          className="text-xs font-bold text-refuse underline mt-1"
        >
          Remplacer le lien de partage
        </button>
      )}

      {message && (
        <p className="text-xs mt-1 font-semibold text-ink-soft break-all">
          {message}
        </p>
      )}
    </div>
  );
}
