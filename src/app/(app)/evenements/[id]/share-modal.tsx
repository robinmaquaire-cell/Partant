"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/avatar";
import { ListLogo } from "@/components/list-logo";
import type { Availability } from "../availability-actions";
import {
  attachEventToGroup,
  detachEventFromGroup,
  pushEventToBroadcast,
  inviteContactsToExistingEvent,
} from "./share-actions";

export type ShareGroup = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  logoUrl: string | null;
  memberCount: number;
  freeCount: number | null; // null = on n'a pas pu calculer
  attached: boolean;
};

export type ShareBroadcast = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  memberCount: number;
};

export type ShareContact = {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
  availability: Availability;
  alreadyInvited: boolean;
};

type Msg = { kind: "ok" | "error"; text: string };

function Pill({ status }: { status: Availability }) {
  const map: Record<Availability, { text: string; cls: string }> = {
    busy: { text: "Pas dispo", cls: "bg-refuse/10 text-refuse" },
    free: { text: "Dispo ✓", cls: "bg-ok/15 text-ok" },
    unknown: { text: "Inconnu", cls: "bg-sand text-ink-soft" },
  };
  const b = map[status];
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${b.cls}`}>
      {b.text}
    </span>
  );
}

export function ShareModal({
  eventId,
  shareUrl,
  groups,
  broadcasts,
  contacts,
  onClose,
}: {
  eventId: string;
  shareUrl: string;
  groups: ShareGroup[];
  broadcasts: ShareBroadcast[];
  contacts: ShareContact[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pending, startTransition] = useTransition();

  // État local pour la sélection contacts / listes de diffusion : à la
  // validation on envoie tout d'un coup.
  const [pickedContacts, setPickedContacts] = useState<Set<string>>(new Set());
  const [pickedBroadcasts, setPickedBroadcasts] = useState<Set<string>>(
    new Set()
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setMsg({ kind: "error", text: `Copie ce lien à la main : ${shareUrl}` });
    }
  };

  const toggleGroup = (g: ShareGroup) =>
    startTransition(async () => {
      setMsg(null);
      const result = g.attached
        ? await detachEventFromGroup(eventId, g.id)
        : await attachEventToGroup(eventId, g.id);
      if (!result.ok) setMsg({ kind: "error", text: result.error });
      else
        setMsg({
          kind: "ok",
          text: g.attached
            ? `« ${g.name} » retiré de l'événement.`
            : `« ${g.name} » ajouté à l'événement.`,
        });
    });

  const toggleContact = (id: string) =>
    setPickedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBroadcast = (id: string) =>
    setPickedBroadcasts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sendInvitations = () =>
    startTransition(async () => {
      setMsg(null);
      let totalAdded = 0;
      const errors: string[] = [];

      if (pickedContacts.size > 0) {
        const r = await inviteContactsToExistingEvent(eventId, [
          ...pickedContacts,
        ]);
        if (r.ok) totalAdded += r.added;
        else errors.push(r.error);
      }
      for (const id of pickedBroadcasts) {
        const r = await pushEventToBroadcast(eventId, id);
        if (r.ok) totalAdded += r.added;
        else errors.push(r.error);
      }

      if (errors.length > 0) {
        setMsg({ kind: "error", text: errors.join(" ") });
        return;
      }
      setPickedContacts(new Set());
      setPickedBroadcasts(new Set());
      setMsg({
        kind: "ok",
        text:
          totalAdded === 0
            ? "Ces personnes étaient déjà invitées."
            : `✓ ${totalAdded} personne${totalAdded > 1 ? "s" : ""} invitée${totalAdded > 1 ? "s" : ""}.`,
      });
    });

  if (typeof document === "undefined") return null;

  const label = "text-xs font-bold uppercase tracking-wide mb-2 text-ink-soft";
  const invitePending = pickedContacts.size + pickedBroadcasts.size;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-paper rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 bg-paper flex items-center justify-between px-5 py-4 border-b-[1.5px] border-line">
          <h3 className="text-lg font-extrabold font-display">🔗 Partager</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-ink-soft"
          >
            Fermer
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {msg && (
            <p
              className={`text-sm font-semibold ${
                msg.kind === "ok" ? "text-ok" : "text-refuse"
              }`}
            >
              {msg.text}
            </p>
          )}

          {/* — 1 — Lien à copier */}
          <section>
            <div className={label}>Lien direct</div>
            <button
              type="button"
              onClick={copyLink}
              className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
            >
              {copied ? "Lien copié ✓" : "🔗 Copier le lien de l'événement"}
            </button>
            <p className="text-xs mt-1 text-ink-soft">
              À partager en dehors de l&apos;app (WhatsApp, SMS…). Le compte se
              crée au passage pour les personnes qui n&apos;en ont pas.
            </p>
          </section>

          {/* — 2 — Groupes */}
          {groups.length > 0 && (
            <section>
              <div className={label}>Partager avec un groupe</div>
              <p className="text-xs mb-2 text-ink-soft">
                Ajouter l&apos;événement à un groupe : tous ses membres le
                verront dans leur fil.
              </p>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={pending}
                  onClick={() => toggleGroup(g)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl mb-1.5 text-left border-[1.5px]"
                  style={{
                    background: g.attached ? g.color + "1A" : "#FFFFFF",
                    borderColor: g.attached ? g.color : "#DCE6E2",
                  }}
                >
                  <ListLogo
                    list={{
                      name: g.name,
                      color: g.color,
                      emoji: g.emoji,
                      logoUrl: g.logoUrl,
                    }}
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {g.name}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {g.freeCount !== null
                        ? `${g.freeCount} libre${g.freeCount > 1 ? "s" : ""} / ${g.memberCount}`
                        : `${g.memberCount} membre${g.memberCount > 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      g.attached
                        ? "bg-signal text-white"
                        : "border-[1.5px] border-line text-ink-soft"
                    }`}
                  >
                    {g.attached ? "✓" : "+"}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* — 3 — Listes de diffusion */}
          {broadcasts.length > 0 && (
            <section>
              <div className={label}>Envoyer à une liste de diffusion</div>
              <p className="text-xs mb-2 text-ink-soft">
                Chaque membre de la liste recevra l&apos;invitation à titre
                personnel. Les personnes déjà invitées sont ignorées.
              </p>
              {broadcasts.map((b) => {
                const on = pickedBroadcasts.has(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBroadcast(b.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl mb-1.5 text-left border-[1.5px]"
                    style={{
                      background: on ? b.color + "1A" : "#FFFFFF",
                      borderColor: on ? b.color : "#DCE6E2",
                    }}
                  >
                    <ListLogo
                      list={{
                        name: b.name,
                        color: b.color,
                        emoji: b.emoji,
                        logoUrl: null,
                      }}
                      size={32}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {b.name}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {b.memberCount} contact
                        {b.memberCount > 1 ? "s" : ""}
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
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
            </section>
          )}

          {/* — 4 — Contacts individuels */}
          {contacts.length > 0 && (
            <section>
              <div className={label}>Inviter des contacts</div>
              <p className="text-xs mb-2 text-ink-soft">
                La pastille indique s&apos;ils sont libres au créneau. Les
                contacts déjà invités apparaissent en gris.
              </p>
              <div className="rounded-xl border-[1.5px] border-line overflow-hidden">
                {contacts.map((c) => {
                  const on = pickedContacts.has(c.id);
                  const disabled = c.alreadyInvited;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleContact(c.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-left bg-card border-b-[1.5px] border-line last:border-b-0 ${
                        disabled ? "opacity-50" : ""
                      }`}
                    >
                      <Avatar
                        pseudo={c.pseudo}
                        url={c.avatarUrl}
                        size={30}
                      />
                      <span className="flex-1 font-semibold text-sm truncate">
                        {c.pseudo}
                      </span>
                      <Pill status={c.availability} />
                      {disabled ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sand text-ink-soft shrink-0">
                          déjà invité
                        </span>
                      ) : (
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            on
                              ? "bg-signal text-white"
                              : "border-[1.5px] border-line text-ink-soft"
                          }`}
                        >
                          {on ? "✓" : "+"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Bouton d'envoi pour les listes de diffusion / contacts sélectionnés */}
          {invitePending > 0 && (
            <div className="sticky bottom-0 bg-paper -mx-5 px-5 pt-3 pb-4 border-t-[1.5px] border-line">
              <button
                type="button"
                disabled={pending}
                onClick={sendInvitations}
                className="w-full px-4 py-3 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
              >
                {pending
                  ? "Envoi…"
                  : `Envoyer les invitations (${invitePending})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
