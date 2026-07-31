"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList } from "./actions";
import { LIST_COLORS } from "@/lib/list-colors";
import { EmojiPicker } from "@/components/emoji-picker";
import { ListLogo } from "@/components/list-logo";
import { Avatar } from "@/components/avatar";

export type ContactOption = {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
};

export function NewListForm({ contacts }: { contacts: ContactOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.pseudo.toLowerCase().includes(q));
  }, [contacts, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      const result = await createList({
        name,
        color,
        membersVisible: visible,
        emoji,
        memberIds: [...selected],
      });
      // En cas de succès, createList redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-4 font-display">
        Nouveau groupe
      </h2>

      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Nom du groupe
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
          Tu pourras aussi mettre une vraie image une fois le groupe créé.
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
            ? "Les membres du groupe peuvent voir qui d'autre en fait partie."
            : "Seuls les admins voient la liste des membres."}
        </p>
      </div>

      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Ajouter des membres{selected.size > 0 ? ` — ${selected.size}` : ""}
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Tu n&apos;as pas encore de contacts. Tu pourras inviter des gens par
            lien une fois le groupe créé.
          </p>
        ) : (
          <>
            <p className="text-xs mb-2 text-ink-soft">
              Pioche parmi tes contacts. Ils seront ajoutés directement au
              groupe (tu pourras aussi inviter par lien plus tard).
            </p>
            <input
              className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river mb-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un contact…"
            />
            <div className="rounded-2xl overflow-hidden border-[1.5px] border-line max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-sm bg-card text-ink-soft">
                  Aucun contact ne correspond.
                </div>
              )}
              {filtered.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left bg-card border-b-[1.5px] border-line last:border-b-0"
                  >
                    <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={32} />
                    <span className="flex-1 font-semibold text-sm">
                      {c.pseudo}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        on
                          ? "bg-signal text-white"
                          : "border-[1.5px] border-line text-ink-soft"
                      }`}
                    >
                      {on ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
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
          {pending ? "Création…" : "Créer le groupe"}
        </button>
      </div>
    </div>
  );
}
