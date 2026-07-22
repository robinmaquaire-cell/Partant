"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { deleteMessage, sendMessage } from "../actions";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  pseudo: string;
  avatarUrl: string | null;
  isMine: boolean;
  canDelete: boolean;
};

// Quand un message a été écrit, en français simple.
function whenLabel(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// La discussion de l'événement : chacun peut poser une question,
// proposer un covoiturage, prévenir d'un retard…
export function ChatSection({
  eventId,
  messages,
}: {
  eventId: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Les messages des autres arrivent sans recharger la page.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`discussion-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_messages",
          filter: `event_id=eq.${eventId}`,
        },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  const send = () =>
    startTransition(async () => {
      setErr("");
      const result = await sendMessage(eventId, text);
      if (result.ok) {
        setText("");
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      } else setErr(result.error);
    });

  const remove = (messageId: string) =>
    startTransition(async () => {
      setErr("");
      const result = await deleteMessage(eventId, messageId);
      if (!result.ok) setErr(result.error);
    });

  return (
    <div className="mb-6">
      <h3 className="font-extrabold mb-2 font-display">
        Discussion{messages.length > 0 ? ` — ${messages.length}` : ""}
      </h3>

      <div className="rounded-2xl overflow-hidden mb-2 border-[1.5px] border-line">
        {messages.length === 0 && (
          <div className="px-4 py-3 text-sm bg-card text-ink-soft">
            Rien pour l&apos;instant — une question sur le rendez-vous, un
            covoiturage à proposer ?
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="flex gap-2 px-3 py-2.5 bg-card border-b-[1.5px] border-line last:border-b-0"
          >
            <Avatar pseudo={m.pseudo} url={m.avatarUrl} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink-soft">
                <span className="font-bold text-ink">
                  {m.isMine ? "Toi" : m.pseudo}
                </span>{" "}
                · <span suppressHydrationWarning>{whenLabel(m.createdAt)}</span>
              </div>
              <div className="text-sm whitespace-pre-line break-words">
                {m.body}
              </div>
            </div>
            {m.canDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(m.id)}
                className="text-refuse font-bold px-1 shrink-0 self-start"
                aria-label="Supprimer ce message"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          className="flex-1 min-w-0 bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river min-h-[44px] max-h-40"
          value={text}
          rows={1}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée passe à la ligne.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) send();
            }
          }}
          placeholder="Écrire un message…"
          aria-label="Écrire un message"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={send}
          className="px-4 py-2.5 rounded-xl font-bold text-white bg-signal shrink-0 transition-transform active:scale-95 disabled:opacity-40"
        >
          {pending ? "…" : "Envoyer"}
        </button>
      </div>

      {err && (
        <p className="text-sm font-semibold mt-2 text-refuse whitespace-pre-line">
          {err}
        </p>
      )}
    </div>
  );
}
