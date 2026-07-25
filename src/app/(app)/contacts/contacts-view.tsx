"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { addContact, removeContact, setContactBlocked } from "./actions";

export type Contact = {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
  blocked: boolean;
  manual: boolean;
  viaList: boolean;
  viaEvent: boolean;
};

const inputCls =
  "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

export function ContactsView({ contacts }: { contacts: Contact[] }) {
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setMsg(null);
      const result = await addContact(query);
      if (result.ok) {
        setQuery("");
        setMsg({ ok: true, text: "Contact ajouté ✓" });
      } else {
        setMsg({ ok: false, text: result.error });
      }
    });

  const toggleBlock = (c: Contact) =>
    startTransition(async () => {
      setMsg(null);
      const result = await setContactBlocked(c.id, !c.blocked);
      if (!result.ok) setMsg({ ok: false, text: result.error });
    });

  const doRemove = (id: string) =>
    startTransition(async () => {
      setMsg(null);
      const result = await removeContact(id);
      if (!result.ok) setMsg({ ok: false, text: result.error });
      setConfirmRemove(null);
    });

  const source = (c: Contact) => {
    const tags: string[] = [];
    if (c.viaList) tags.push("Liste");
    if (c.viaEvent) tags.push("Événement");
    if (c.manual && tags.length === 0) tags.push("Ajouté");
    return tags;
  };

  return (
    <div className="pb-8">
      <Link
        href="/listes"
        className="inline-block text-sm font-bold mb-3 text-ink-soft"
      >
        ← Mes listes
      </Link>
      <h2 className="text-xl font-extrabold mb-1 font-display">Mes contacts</h2>
      <p className="text-sm mb-4 text-ink-soft">
        Les gens croisés dans tes listes et tes événements, plus ceux que tu
        ajoutes toi-même.
      </p>

      {/* Ajout manuel */}
      <div className="rounded-2xl p-3 mb-4 bg-card border-[1.5px] border-line">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Ajouter un contact
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim() && add()}
            placeholder="E-mail ou pseudo"
          />
          <button
            type="button"
            disabled={pending || !query.trim()}
            onClick={add}
            className="px-4 py-2.5 rounded-xl font-bold text-white bg-signal shrink-0 disabled:opacity-50"
          >
            +
          </button>
        </div>
        {msg && (
          <p
            className={`text-sm font-semibold mt-2 ${
              msg.ok ? "text-ok" : "text-refuse"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {contacts.length === 0 && (
        <div className="text-center py-10 text-ink-soft">
          Aucun contact pour l&apos;instant. Rejoins une liste, participe à un
          événement, ou ajoute quelqu&apos;un ci-dessus.
        </div>
      )}

      {contacts.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl p-3 mb-2 bg-card border-[1.5px] border-line"
        >
          <div className="flex items-center gap-3">
            <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={40} />
            <div className="flex-1 min-w-0">
              <div className="font-bold flex items-center gap-1.5">
                {c.pseudo}
                {c.blocked && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-refuse/15 text-refuse">
                    bloqué
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 mt-0.5">
                {source(c).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-sand text-pine"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={`/contacts/${c.id}`}
              className="text-sm font-bold text-river shrink-0 px-2"
            >
              En commun ›
            </Link>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleBlock(c)}
              className={`flex-1 py-1.5 text-sm rounded-xl font-bold border-[1.5px] disabled:opacity-60 ${
                c.blocked
                  ? "text-ok border-ok/50"
                  : "text-ink-soft border-line"
              }`}
            >
              {c.blocked ? "Débloquer ses événements" : "Bloquer ses événements"}
            </button>
            {confirmRemove === c.id ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => doRemove(c.id)}
                className="px-3 py-1.5 text-sm rounded-xl font-bold text-white bg-refuse disabled:opacity-60"
              >
                Confirmer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(c.id)}
                className="px-3 py-1.5 text-sm rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
