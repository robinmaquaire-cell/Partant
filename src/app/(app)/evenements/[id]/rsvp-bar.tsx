"use client";

import { useState, useTransition } from "react";
import { resignOrganizer, setRsvp } from "../actions";

export function RsvpBar({
  eventId,
  myStatus,
  full,
  organizer,
}: {
  eventId: string;
  myStatus: "yes" | "no" | null;
  full: boolean;
  organizer: boolean;
}) {
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const answer = (status: "yes" | "no") =>
    startTransition(async () => {
      setErr("");
      const result = await setRsvp(eventId, status);
      if (!result.ok) setErr(result.error);
    });

  const resign = () =>
    startTransition(async () => {
      setErr("");
      const result = await resignOrganizer(eventId);
      if (!result.ok) setErr(result.error);
      else setConfirming(false);
    });

  if (organizer) {
    return (
      <div className="fixed bottom-[58px] left-0 right-0 px-5 py-3 z-10 bg-card border-t-[1.5px] border-line">
        <div className="max-w-lg mx-auto">
          {err && (
            <p className="text-sm font-semibold mb-2 text-center text-refuse">
              {err}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 font-bold text-sm text-ok">
              ⭐ Tu organises cet événement — donc partant·e !
            </div>
            {confirming ? (
              <button
                type="button"
                disabled={pending}
                onClick={resign}
                className="px-3 py-2 rounded-xl text-sm font-bold text-white bg-refuse disabled:opacity-60"
              >
                {pending ? "Un instant…" : "Confirmer"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="px-3 py-2 rounded-xl text-sm font-bold text-refuse border-[1.5px] border-refuse/40"
              >
                Me désinscrire
              </button>
            )}
          </div>
          {confirming && !pending && (
            <p className="text-xs mt-1 text-ink-soft">
              Tu ne seras plus ni organisateur·rice ni partant·e.{" "}
              <button
                type="button"
                className="underline font-semibold"
                onClick={() => setConfirming(false)}
              >
                Annuler
              </button>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    // Barre fixe posée juste au-dessus des onglets de navigation.
    <div className="fixed bottom-[58px] left-0 right-0 px-5 py-3 z-10 bg-card border-t-[1.5px] border-line">
      <div className="max-w-lg mx-auto">
        {err && (
          <p className="text-sm font-semibold mb-2 text-center text-refuse">
            {err}
          </p>
        )}
        {full && myStatus !== "yes" && (
          <p className="text-xs font-semibold mb-2 text-center text-ink-soft">
            Événement complet — tu peux quand même indiquer « Pas dispo ».
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending || (full && myStatus !== "yes")}
            onClick={() => answer("yes")}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-60 ${
              myStatus === "yes" ? "bg-ok text-white" : "bg-ink text-paper"
            }`}
          >
            {myStatus === "yes" ? "J'y serai ✓" : "Partant !"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => answer("no")}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-60 ${
              myStatus === "no"
                ? "bg-refuse text-white"
                : "text-refuse border-[1.5px] border-refuse/40"
            }`}
          >
            {myStatus === "no" ? "Pas dispo ✓" : "Pas dispo"}
          </button>
        </div>
      </div>
    </div>
  );
}
