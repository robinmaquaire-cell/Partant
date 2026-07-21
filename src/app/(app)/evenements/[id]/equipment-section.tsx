"use client";

import { useState, useTransition } from "react";
import { groupByCategory, SUGGESTED_CATEGORIES } from "@/lib/equipment-categories";
import {
  addOwnItem,
  removeOwnItem,
  setConfirmation,
  setContribution,
} from "../actions";

type IndivItem = {
  id: string;
  name: string;
  qty: number; // quantité à prévoir par personne
  category: string | null;
  iHave: boolean;
  confirmedNames: string[];
};

type CollItem = {
  id: string;
  name: string;
  qty: number;
  category: string | null;
  isMine: boolean; // je l'ai ajouté moi-même (mode collaboratif)
  addedByName: string | null;
  myQty: number;
  othersQty: number;
  detail: string; // « 2 par Léa, 1 par toi »
};

const inputCls =
  "bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

const catTitle =
  "text-xs font-bold uppercase tracking-wide mt-3 mb-1 text-ink-soft";

export function EquipmentSection({
  eventId,
  collaborative,
  indivItems,
  collItems,
}: {
  eventId: string;
  collaborative: boolean;
  indivItems: IndivItem[];
  collItems: CollItem[];
}) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newCat, setNewCat] = useState("");

  // Les catégories ne s'affichent que si l'organisateur en a défini.
  const indivGroups = groupByCategory(indivItems);
  const collGroups = groupByCategory(collItems);
  const showIndivCats = indivItems.some((it) => (it.category ?? "").trim());
  const showCollCats = collItems.some((it) => (it.category ?? "").trim());
  const categoryOptions = [
    ...new Set([
      ...[...indivItems, ...collItems]
        .map((it) => (it.category ?? "").trim())
        .filter(Boolean),
      ...SUGGESTED_CATEGORIES,
    ]),
  ];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setErr("");
      const result = await fn();
      if (!result.ok && result.error) setErr(result.error);
    });

  return (
    <div>
      {indivItems.length > 0 && (
        <>
          <h3 className="font-extrabold mb-2 font-display">À prévoir chacun</h3>
          {indivGroups.map((group) => (
            <div key={group.category} className="mb-3 last:mb-6">
              {showIndivCats && (
                <div className={catTitle}>{group.category}</div>
              )}
              <div className="rounded-2xl overflow-hidden border-[1.5px] border-line">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 bg-card border-b-[1.5px] border-line last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {item.name}{" "}
                        <span className="text-ink-soft">
                          · {item.qty} par personne
                        </span>
                      </div>
                      <div className="text-xs text-ink-soft">
                        {item.confirmedNames.length > 0
                          ? "Confirmé : " + item.confirmedNames.join(", ")
                          : "Personne n'a encore confirmé"}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => setConfirmation(eventId, item.id, !item.iHave))
                      }
                      className={`px-3 py-1.5 text-sm rounded-xl font-bold shrink-0 disabled:opacity-60 ${
                        item.iHave
                          ? "bg-ok text-white"
                          : "text-ink-soft border-[1.5px] border-line"
                      }`}
                    >
                      {item.qty > 1
                        ? item.iHave
                          ? "J'ai les miens ✓"
                          : "J'ai les miens"
                        : item.iHave
                          ? "J'ai le mien ✓"
                          : "J'ai le mien"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <h3 className="font-extrabold mb-2 font-display">Matériel pour le groupe</h3>
      {collGroups.map((group) => (
        <div key={group.category} className="mb-3">
          {showCollCats && <div className={catTitle}>{group.category}</div>}
          <div className="rounded-2xl overflow-hidden border-[1.5px] border-line">
            {group.items.map((item) => {
              const total = item.myQty + item.othersQty;
              const remaining = Math.max(0, item.qty - total);
              const maxMine = item.qty - item.othersQty;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-4 py-3 bg-card border-b-[1.5px] border-line last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
                      {item.name} <span className="text-ink-soft">×{item.qty}</span>
                      {item.addedByName && (
                        <span className="text-xs font-normal text-river">
                          {" "}
                          · ajouté par {item.addedByName}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs ${remaining === 0 ? "text-ok" : "text-ink-soft"}`}
                    >
                      {item.detail ? item.detail + " · " : ""}
                      {remaining === 0
                        ? "Complet ✓"
                        : `Reste ${remaining} à trouver`}
                    </div>
                  </div>

                  {item.qty === 1 ? (
                    remaining === 0 && item.myQty === 0 ? (
                      <span className="text-xs font-bold text-ok shrink-0">Pris ✓</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setContribution(eventId, item.id, item.myQty ? 0 : 1)
                          )
                        }
                        className={`px-3 py-1.5 text-sm rounded-xl font-bold shrink-0 disabled:opacity-60 ${
                          item.myQty
                            ? "bg-ok text-white"
                            : "text-ink-soft border-[1.5px] border-line"
                        }`}
                      >
                        {item.myQty ? "Je ramène ✓" : "Je ramène"}
                      </button>
                    )
                  ) : item.myQty > 0 ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setContribution(eventId, item.id, item.myQty - 1)
                          )
                        }
                        className="w-8 h-8 rounded-lg font-bold text-lg border-[1.5px] border-line text-ink disabled:opacity-60"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-extrabold text-ok">
                        {item.myQty}
                      </span>
                      <button
                        type="button"
                        disabled={pending || item.myQty >= maxMine}
                        onClick={() =>
                          run(() =>
                            setContribution(
                              eventId,
                              item.id,
                              Math.min(item.myQty + 1, maxMine)
                            )
                          )
                        }
                        className={`w-8 h-8 rounded-lg font-bold text-lg border-[1.5px] border-line disabled:opacity-40 ${
                          item.myQty >= maxMine ? "text-line" : "text-ink"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  ) : remaining === 0 ? (
                    <span className="text-xs font-bold text-ok shrink-0">Pris ✓</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setContribution(eventId, item.id, 1))}
                      className="px-3 py-1.5 text-sm rounded-xl font-bold shrink-0 text-ink-soft border-[1.5px] border-line disabled:opacity-60"
                    >
                      J&apos;en ramène
                    </button>
                  )}

                  {item.isMine && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeOwnItem(eventId, item.id))}
                      className="shrink-0 text-refuse font-bold px-1"
                      aria-label={`Retirer ${item.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {collItems.length === 0 && (
        <div className="rounded-2xl overflow-hidden mb-3 border-[1.5px] border-line">
          <div className="px-4 py-3 text-sm bg-card text-ink-soft">
            {collaborative
              ? "Rien pour l'instant — ajoute ce que tu ramènes !"
              : "Rien à prévoir, venez comme vous êtes."}
          </div>
        </div>
      )}

      {collaborative && (
        <div className="rounded-2xl p-3 mb-4 bg-card border-[1.5px] border-dashed border-river">
          <div className="text-sm font-bold mb-2 text-river">
            ✨ Événement collaboratif — ajoute ce que tu ramènes
          </div>
          <input
            className={`${inputCls} w-full mb-2`}
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            list="categories-materiel-event"
            placeholder="Catégorie (facultatif) — ex. Nourriture"
            maxLength={30}
          />
          <datalist id="categories-materiel-event">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1 min-w-0`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ex. Chips"
            />
            <input
              type="number"
              min={1}
              max={999}
              className={`${inputCls} w-16`}
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value))}
              aria-label="Quantité"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!newName.trim()) return;
                run(async () => {
                  const result = await addOwnItem(
                    eventId,
                    newName.trim(),
                    Math.max(1, newQty || 1),
                    newCat.trim() || null
                  );
                  if (result.ok) {
                    setNewName("");
                    setNewQty(1);
                  }
                  return result;
                });
              }}
              className="px-3 py-1.5 text-sm rounded-xl font-bold bg-ink text-paper disabled:opacity-60"
            >
              +
            </button>
          </div>
        </div>
      )}

      {err && <p className="text-sm font-semibold mb-3 text-refuse">{err}</p>}
    </div>
  );
}
