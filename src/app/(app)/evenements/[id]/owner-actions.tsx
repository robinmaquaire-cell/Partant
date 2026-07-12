"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteEvent } from "../actions";

export function OwnerActions({ eventId }: { eventId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      setErr("");
      const result = await deleteEvent(eventId);
      // En cas de succès, l'action redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <Link
          href={`/evenements/${eventId}/modifier`}
          className="flex-1 text-center px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line bg-card"
        >
          ✏️ Modifier
        </Link>
        {confirming ? (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-white bg-refuse disabled:opacity-60"
          >
            {pending ? "Suppression…" : "Confirmer la suppression"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-refuse border-[1.5px] border-refuse/40 bg-card"
          >
            🗑 Supprimer
          </button>
        )}
      </div>
      {confirming && !pending && (
        <p className="text-xs mt-1 text-center text-ink-soft">
          La suppression est définitive (réponses et matériel compris).{" "}
          <button
            type="button"
            className="underline font-semibold"
            onClick={() => setConfirming(false)}
          >
            Annuler
          </button>
        </p>
      )}
      {err && (
        <p className="text-sm font-semibold mt-2 text-center text-refuse">{err}</p>
      )}
    </div>
  );
}
