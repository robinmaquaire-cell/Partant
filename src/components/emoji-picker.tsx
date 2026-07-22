"use client";

import { LIST_EMOJIS } from "@/lib/list-emojis";

// Palette d'emojis + saisie libre, pour choisir le logo d'une liste.
export function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {LIST_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(value === e ? null : e)}
            className={`w-9 h-9 rounded-xl text-lg leading-none flex items-center justify-center border-[1.5px] ${
              value === e ? "bg-ink border-ink" : "bg-card border-line"
            }`}
            aria-label={`Emoji ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="w-20 text-center bg-card border-[1.5px] border-line rounded-xl px-2 py-2 text-lg text-ink outline-none focus:border-river"
          value={value ?? ""}
          maxLength={4}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder="🙂"
          aria-label="Autre emoji"
        />
        <span className="text-xs text-ink-soft">
          …ou colle l&apos;emoji de ton choix
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-bold underline text-ink-soft ml-auto"
          >
            Aucun
          </button>
        )}
      </div>
    </div>
  );
}
