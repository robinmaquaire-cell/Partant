"use client";

import { useState, useTransition } from "react";
import { setRsvp } from "../actions";

export function RsvpBar({
  eventId,
  myStatus,
  full,
}: {
  eventId: string;
  myStatus: "yes" | "no" | null;
  full: boolean;
}) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const answer = (status: "yes" | "no") =>
    startTransition(async () => {
      setErr("");
      const result = await setRsvp(eventId, status);
      if (!result.ok) setErr(result.error);
    });

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
