"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { ListLogo } from "@/components/list-logo";
import { setBusyShareMode, type ShareMode } from "./availability-actions";

export type ShareContact = {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
};

export type ShareGroup = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  logoUrl: string | null;
};

export function ShareDispoPanel({
  initialMode,
  initialContactIds,
  initialGroupIds,
  contacts,
  groups,
}: {
  initialMode: ShareMode;
  initialContactIds: string[];
  initialGroupIds: string[];
  contacts: ShareContact[];
  groups: ShareGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ShareMode>(initialMode);
  const [pickedContacts, setPickedContacts] = useState<Set<string>>(
    new Set(initialContactIds)
  );
  const [pickedGroups, setPickedGroups] = useState<Set<string>>(
    new Set(initialGroupIds)
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const modeLabel = useMemo(() => {
    if (mode === "everyone") return "Tous mes contacts";
    if (mode === "none") return "Personne";
    const n = pickedContacts.size + pickedGroups.size;
    if (n === 0) return "Personne (aucun choix)";
    return `${n} ${n > 1 ? "sélections" : "sélection"}`;
  }, [mode, pickedContacts, pickedGroups]);

  const toggleContact = (id: string) =>
    setPickedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (id: string) =>
    setPickedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const result = await setBusyShareMode(
        mode,
        [...pickedContacts],
        [...pickedGroups]
      );
      if (!result.ok) setMsg({ ok: false, text: result.error });
      else setMsg({ ok: true, text: "Partage mis à jour ✓" });
    });

  return (
    <div className="rounded-2xl p-3 mt-4 bg-card border-[1.5px] border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <div className="text-sm font-bold text-ink">
            👁 Qui voit ma disponibilité
          </div>
          <div className="text-xs text-ink-soft mt-0.5">{modeLabel}</div>
        </div>
        <span className="text-ink-soft">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t-[1.5px] border-line">
          <p className="text-xs mb-3 text-ink-soft">
            Contrôle qui voit ta pastille de dispo quand on t&apos;invite à un
            événement. Personne ne voit jamais le détail de tes créneaux —
            seulement <strong>libre</strong> ou <strong>occupé</strong>.
          </p>

          <div className="flex flex-col gap-2 mb-3">
            {(
              [
                {
                  v: "none" as const,
                  label: "🔒 Personne",
                  hint: "Ta dispo reste privée.",
                },
                {
                  v: "everyone" as const,
                  label: "🌍 Tous mes contacts",
                  hint: "Tous ceux dans ton carnet voient ta dispo.",
                },
                {
                  v: "custom" as const,
                  label: "🎯 Sélection",
                  hint: "Choisis les contacts et/ou groupes qui la voient.",
                },
              ]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setMode(o.v)}
                className={`text-left rounded-xl px-3 py-2 border-[1.5px] ${
                  mode === o.v
                    ? "bg-ink text-paper border-ink"
                    : "bg-card text-ink border-line"
                }`}
              >
                <div className="text-sm font-bold">{o.label}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    mode === o.v ? "text-paper/80" : "text-ink-soft"
                  }`}
                >
                  {o.hint}
                </div>
              </button>
            ))}
          </div>

          {mode === "custom" && (
            <>
              {contacts.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
                    Contacts ({pickedContacts.size})
                  </div>
                  <div className="rounded-xl overflow-hidden border-[1.5px] border-line max-h-56 overflow-y-auto">
                    {contacts.map((c) => {
                      const on = pickedContacts.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleContact(c.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left bg-card border-b-[1.5px] border-line last:border-b-0"
                        >
                          <Avatar pseudo={c.pseudo} url={c.avatarUrl} size={28} />
                          <span className="flex-1 text-sm font-semibold truncate">
                            {c.pseudo}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
                </div>
              )}

              {groups.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
                    Groupes ({pickedGroups.size})
                  </div>
                  <div className="rounded-xl overflow-hidden border-[1.5px] border-line max-h-56 overflow-y-auto">
                    {groups.map((g) => {
                      const on = pickedGroups.has(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left bg-card border-b-[1.5px] border-line last:border-b-0"
                        >
                          <ListLogo
                            list={{
                              name: g.name,
                              color: g.color,
                              emoji: g.emoji,
                              logoUrl: g.logoUrl,
                            }}
                            size={28}
                          />
                          <span className="flex-1 text-sm font-semibold truncate">
                            {g.name}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
                </div>
              )}
            </>
          )}

          {msg && (
            <p
              className={`text-sm font-semibold mb-2 ${
                msg.ok ? "text-ok" : "text-refuse"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="w-full px-4 py-2 rounded-xl font-bold text-white bg-signal disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}
