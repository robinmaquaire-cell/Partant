"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { removeEventRole, setRoleTaken } from "../actions";

type Person = { userId: string; pseudo: string; avatarUrl: string | null };

export type RoleData = {
  id: string;
  name: string;
  capacity: number;
  takers: Person[];
  mine: boolean;
};

// Les rôles à occuper sur un événement : chacun peut se proposer, dans la
// limite du nombre de personnes prévu. Les rôles se créent à la création de
// l'événement ou en le modifiant (réservé aux organisateurs) — pas ici.
export function RolesSection({
  eventId,
  isOrganizer,
  canTake,
  roles,
}: {
  eventId: string;
  isOrganizer: boolean;
  canTake: boolean; // je suis partant·e (sinon je ne peux pas prendre de rôle)
  roles: RoleData[];
}) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr("");
      const result = await fn();
      if (!result.ok && result.error) setErr(result.error);
    });

  // Pas de rôle défini = pas de section (les organisateurs en ajoutent
  // depuis le formulaire de modification de l'événement).
  if (roles.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="font-extrabold mb-2 font-display">Rôles à occuper</h3>

      <div className="rounded-2xl overflow-hidden mb-2 border-[1.5px] border-line">
        {roles.map((role) => {
          const free = role.capacity - role.takers.length;
          return (
            <div
              key={role.id}
              className="flex items-center justify-between gap-2 px-4 py-3 bg-card border-b-[1.5px] border-line last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  {role.name}{" "}
                  <span className="text-ink-soft">
                    · {role.takers.length}/{role.capacity}
                  </span>
                </div>
                {role.takers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {role.takers.map((p) => (
                      <span
                        key={p.userId}
                        className="pl-0.5 pr-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 bg-paper border-[1.5px] border-line"
                      >
                        <Avatar pseudo={p.pseudo} url={p.avatarUrl} size={18} />
                        {p.pseudo}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-ink-soft">
                    Personne pour l&apos;instant
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {role.mine ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => setRoleTaken(eventId, role.id, false))
                    }
                    className="px-3 py-1.5 text-sm rounded-xl font-bold bg-ok text-white disabled:opacity-60"
                  >
                    Je m&apos;en occupe ✓
                  </button>
                ) : free <= 0 ? (
                  <span className="text-xs font-bold text-ok">Complet ✓</span>
                ) : canTake ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => setRoleTaken(eventId, role.id, true))
                    }
                    className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line disabled:opacity-60"
                  >
                    Je m&apos;en occupe
                  </button>
                ) : (
                  <span className="text-xs text-ink-soft">
                    Reste {free} place{free > 1 ? "s" : ""}
                  </span>
                )}
                {isOrganizer && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeEventRole(eventId, role.id))}
                    className="text-refuse font-bold px-1"
                    aria-label={`Supprimer le rôle ${role.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!canTake && (
        <p className="text-xs mb-2 text-ink-soft">
          Réponds « Partant ! » pour pouvoir prendre un rôle.
        </p>
      )}
      {isOrganizer && (
        <p className="text-xs text-ink-soft">
          Pour ajouter un rôle, modifie l&apos;événement.
        </p>
      )}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
