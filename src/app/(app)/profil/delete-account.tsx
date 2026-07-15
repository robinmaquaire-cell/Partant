"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      setErr("");
      const result = await deleteAccount();
      // En cas de succès, l'action redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div className="mt-10 rounded-2xl p-4 border-[1.5px] border-refuse/40 bg-card">
      <div className="text-sm font-bold mb-1 text-refuse">Zone sensible</div>
      <p className="text-sm text-ink-soft mb-3">
        Supprimer ton compte efface immédiatement et définitivement ton profil,
        tes réponses, tes contributions de matériel et les événements que tu as
        créés.
      </p>
      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-white bg-refuse disabled:opacity-60"
          >
            {pending ? "Suppression…" : "Oui, tout supprimer"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-3 py-2 rounded-xl text-sm font-bold text-refuse border-[1.5px] border-refuse/40"
        >
          Supprimer mon compte
        </button>
      )}
      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
