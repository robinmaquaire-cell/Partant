"use client";

import { useState, useTransition } from "react";
import { renameList } from "./actions";

// Le titre de la liste, renommable en place par ses admins.
export function ListTitle({
  listId,
  name,
  isAdmin,
}: {
  listId: string;
  name: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await renameList(listId, value);
      if (result.ok) setEditing(false);
      else setErr(result.error);
    });

  if (!editing)
    return (
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-extrabold font-display flex-1">{name}</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setValue(name);
              setErr("");
              setEditing(true);
            }}
            className="text-sm font-bold px-2 py-1 rounded-lg bg-white/20 shrink-0"
            aria-label="Renommer la liste"
          >
            ✏️ Renommer
          </button>
        )}
      </div>
    );

  return (
    <div>
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full rounded-xl px-3 py-2 text-xl font-extrabold font-display text-ink bg-card outline-none"
      />
      {err && <p className="text-sm font-semibold mt-1 text-paper">{err}</p>}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-signal disabled:opacity-60"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-white/20"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
