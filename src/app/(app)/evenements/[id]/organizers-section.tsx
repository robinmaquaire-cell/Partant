"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { addOrganizer } from "../actions";

type Person = { userId: string; pseudo: string; avatarUrl: string | null };

export function OrganizersSection({
  eventId,
  isOrganizer,
  organizers,
  candidates,
}: {
  eventId: string;
  isOrganizer: boolean;
  organizers: Person[];
  candidates: Person[]; // partants qui ne sont pas encore organisateurs
}) {
  const [choosing, setChoosing] = useState(false);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const promote = (userId: string) =>
    startTransition(async () => {
      setErr("");
      const result = await addOrganizer(eventId, userId);
      if (!result.ok) setErr(result.error);
      else setChoosing(false);
    });

  return (
    <div className="mb-6">
      <h3 className="font-extrabold mb-2 font-display">
        Organisé par{organizers.length > 1 ? ` — ${organizers.length}` : ""}
      </h3>
      <div className="flex flex-wrap gap-2">
        {organizers.map((p) => (
          <span
            key={p.userId}
            className="pl-1 pr-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 bg-card border-[1.5px] border-line"
          >
            <Avatar pseudo={p.pseudo} url={p.avatarUrl} size={24} />
            ⭐ {p.pseudo}
          </span>
        ))}
        {isOrganizer && candidates.length > 0 && !choosing && (
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="px-3 py-1 rounded-full text-sm font-bold text-river border-[1.5px] border-river/50"
          >
            + Nommer un organisateur
          </button>
        )}
      </div>

      {choosing && (
        <div className="mt-2 rounded-2xl p-3 bg-card border-[1.5px] border-line">
          <div className="text-xs font-bold uppercase tracking-wide mb-2 text-ink-soft">
            Nommer un partant organisateur
          </div>
          <div className="flex flex-wrap gap-2">
            {candidates.map((p) => (
              <button
                key={p.userId}
                type="button"
                disabled={pending}
                onClick={() => promote(p.userId)}
                className="pl-1 pr-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 border-[1.5px] border-line disabled:opacity-60"
              >
                <Avatar pseudo={p.pseudo} url={p.avatarUrl} size={24} />
                {p.pseudo} +
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs underline mt-2 text-ink-soft"
            onClick={() => setChoosing(false)}
          >
            Annuler
          </button>
        </div>
      )}
      {isOrganizer && candidates.length === 0 && (
        <p className="text-xs mt-1 text-ink-soft">
          Seul un « Partant ! » peut être nommé organisateur.
        </p>
      )}
      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
