"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { addEventRole, removeEventRole, setRoleTaken } from "../actions";

type Person = { userId: string; pseudo: string; avatarUrl: string | null };

export type RoleData = {
  id: string;
  name: string;
  capacity: number;
  takers: Person[];
  mine: boolean;
};

const inputCls =
  "bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

// Les rôles à occuper sur un événement : chacun peut se proposer,
// dans la limite du nombre de personnes prévu par les organisateurs.
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [cap, setCap] = useState(1);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr("");
      const result = await fn();
      if (!result.ok && result.error) setErr(result.error);
    });

  if (roles.length === 0 && !isOrganizer) return null;

  return (
    <div className="mb-6">
      <h3 className="font-extrabold mb-2 font-display">Rôles à occuper</h3>

      {roles.length > 0 && (
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
      )}

      {!canTake && roles.length > 0 && (
        <p className="text-xs mb-2 text-ink-soft">
          Réponds « Partant ! » pour pouvoir prendre un rôle.
        </p>
      )}

      {isOrganizer &&
        (adding ? (
          <div className="rounded-2xl p-3 bg-card border-[1.5px] border-dashed border-river">
            <div className="text-sm font-bold mb-2 text-river">
              Nouveau rôle — et pour combien de personnes ?
            </div>
            <div className="flex gap-2">
              <input
                className={`${inputCls} flex-1 min-w-0`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Responsable repas"
                maxLength={40}
              />
              <input
                type="number"
                min={1}
                max={100}
                className={`${inputCls} w-16 text-center`}
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
                aria-label="Nombre de personnes pour ce rôle"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!name.trim()) return;
                  run(async () => {
                    const result = await addEventRole(
                      eventId,
                      name.trim(),
                      Math.max(1, cap || 1)
                    );
                    if (result.ok) {
                      setName("");
                      setCap(1);
                      setAdding(false);
                    }
                    return result;
                  });
                }}
                className="px-3 py-1.5 text-sm rounded-xl font-bold bg-ink text-paper shrink-0 disabled:opacity-60"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="text-xs underline mt-2 text-ink-soft"
              onClick={() => setAdding(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-3 py-1 rounded-full text-sm font-bold text-river border-[1.5px] border-river/50"
          >
            + Créer un rôle
          </button>
        ))}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
