"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { EmojiPicker } from "@/components/emoji-picker";
import { ListLogo } from "@/components/list-logo";
import { LIST_COLORS } from "@/lib/list-colors";
import {
  createBroadcastList,
  deleteBroadcastList,
  updateBroadcastList,
} from "./actions";

export type ContactOption = {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
};

type Mode =
  | { edit: false }
  | { edit: true; id: string };

export function BroadcastListForm({
  contacts,
  initial,
  mode,
}: {
  contacts: ContactOption[];
  initial: {
    name: string;
    color: string;
    emoji: string | null;
    contactIds: string[];
  };
  mode: Mode;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [emoji, setEmoji] = useState<string | null>(initial.emoji);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.contactIds)
  );
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      const input = {
        name,
        color,
        emoji,
        contactIds: [...selected],
      };
      const result = mode.edit
        ? await updateBroadcastList(mode.id, input)
        : await createBroadcastList(input);
      // En cas de succès, l'action redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  const doDelete = () =>
    startTransition(async () => {
      if (!mode.edit) return;
      const result = await deleteBroadcastList(mode.id);
      if (result && !result.ok) setErr(result.error);
    });

  const label =
    "text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft";
  const inputCls =
    "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

  return (
    <div className="pb-8">
      <button
        type="button"
        onClick={() => router.push("/contacts/listes")}
        className="text-sm font-bold mb-3 text-ink-soft"
      >
        ← Retour
      </button>
      <h2 className="text-xl font-extrabold mb-4 font-display">
        {mode.edit ? "Modifier la liste" : "Nouvelle liste de diffusion"}
      </h2>

      <label className="block mb-3">
        <div className={label}>Nom de la liste</div>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. Copains d'escalade"
        />
      </label>

      <div className="mb-3">
        <div className={label}>Couleur</div>
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
          <div className={label + " mb-0"}>Logo</div>
          <ListLogo
            list={{ name, color, emoji, logoUrl: null }}
            size={28}
          />
        </div>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>

      <div className="mb-3">
        <div className={label}>
          Contacts{selected.size > 0 ? ` — ${selected.size}` : ""}
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Tu n&apos;as pas encore de contacts. Ajoute des contacts d&apos;abord
            (onglet Contacts).
          </p>
        ) : (
          <>
            <input
              className={inputCls + " mb-2"}
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

      {err && (
        <p className="text-sm font-semibold mb-2 text-refuse whitespace-pre-line">
          {err}
        </p>
      )}

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
          {pending
            ? "Enregistrement…"
            : mode.edit
              ? "Enregistrer"
              : "Créer la liste"}
        </button>
      </div>

      {mode.edit && (
        <div className="mt-6 pt-6 border-t-[1.5px] border-line">
          {confirmDelete ? (
            <div className="rounded-xl p-3 bg-refuse/10 border-[1.5px] border-refuse/40">
              <p className="text-sm font-semibold mb-2">
                Supprimer cette liste ? Les événements déjà envoyés restent
                visibles chez les contacts.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={pending}
                  className="flex-1 px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-refuse disabled:opacity-60"
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40"
            >
              Supprimer cette liste
            </button>
          )}
        </div>
      )}
    </div>
  );
}
