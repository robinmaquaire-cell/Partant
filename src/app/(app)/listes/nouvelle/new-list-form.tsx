"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList } from "./actions";
import { LIST_COLORS } from "@/lib/list-colors";
import { EmojiPicker } from "@/components/emoji-picker";
import { ListLogo } from "@/components/list-logo";

export function NewListForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await createList({
        name,
        color,
        membersVisible: visible,
        emoji,
      });
      // En cas de succès, createList redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-4 font-display">
        Nouvelle liste de diffusion
      </h2>

      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Nom de la liste
        </div>
        <input
          className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. Sorties escalade"
        />
      </label>

      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Couleur
        </div>
        <div className="flex gap-2">
          {LIST_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-9 h-9 rounded-xl"
              style={{
                background: c,
                outline: color === c ? "3px solid #10302C" : "none",
                outlineOffset: 2,
              }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Logo
          </div>
          <ListLogo list={{ name, color, emoji }} size={28} />
        </div>
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <p className="text-xs mt-1 text-ink-soft">
          Tu pourras aussi mettre une vraie image une fois la liste créée.
        </p>
      </div>

      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Confidentialité
        </div>
        <div className="flex gap-2">
          {[
            { v: true, label: "👀 Membres visibles" },
            { v: false, label: "🔒 Membres masqués" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setVisible(o.v)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold border-[1.5px] ${
                visible === o.v
                  ? "bg-ink text-paper border-ink"
                  : "text-ink-soft border-line"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs mt-1 text-ink-soft">
          {visible
            ? "Les membres de la liste peuvent voir qui d'autre en fait partie."
            : "Seuls les admins voient la liste des membres."}
        </p>
      </div>

      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer la liste"}
        </button>
      </div>
    </div>
  );
}
