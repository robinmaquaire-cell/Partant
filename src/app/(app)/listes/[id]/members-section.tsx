"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { addMemberByEmail, promoteMember, removeMember } from "./actions";

type Member = {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  role: "admin" | "member";
};

export function MembersSection({
  listId,
  myUserId,
  isAdmin,
  membersHidden,
  members,
}: {
  listId: string;
  myUserId: string;
  isAdmin: boolean;
  membersHidden: boolean;
  members: Member[];
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await fn();
      if (!result.ok)
        setMessage({ kind: "error", text: result.error ?? "Échec." });
    });

  if (membersHidden) {
    return (
      <div className="mt-6 mb-6">
        <h3 className="font-extrabold mb-2 font-display">Membres</h3>
        <p className="text-sm text-ink-soft">
          🔒 L&apos;administrateur a masqué la liste des membres.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-6">
      <h3 className="font-extrabold mb-2 font-display">Membres</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        {members.map((m) => (
          <span
            key={m.userId}
            className="pl-1 pr-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 bg-card border-[1.5px] border-line"
          >
            <Avatar pseudo={m.pseudo} url={m.avatarUrl} size={24} />
            {m.pseudo}
            {m.userId === myUserId && " (toi)"}
            {m.role === "admin" && (
              <span className="text-xs font-bold text-river">admin</span>
            )}
            {isAdmin && m.userId !== myUserId && (
              <>
                {m.role !== "admin" && (
                  <button
                    title="Promouvoir admin"
                    className="text-river font-bold"
                    disabled={pending}
                    onClick={() =>
                      run(() => promoteMember(listId, m.userId))
                    }
                  >
                    ↑
                  </button>
                )}
                <button
                  title="Retirer de la liste"
                  className="text-refuse"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Retirer ${m.pseudo} de la liste ?`
                      )
                    )
                      run(() => removeMember(listId, m.userId));
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </span>
        ))}
      </div>
      {isAdmin && (
        <>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ajouter par e-mail (compte existant)"
            />
            <button
              className="px-4 rounded-xl font-bold bg-ink text-paper disabled:opacity-60"
              disabled={pending || !email.trim()}
              onClick={() =>
                run(async () => {
                  const result = await addMemberByEmail(listId, email);
                  if (result.ok) setEmail("");
                  return result;
                })
              }
            >
              +
            </button>
          </div>
          <p className="text-xs mt-1 text-ink-soft">
            ↑ promouvoir admin · ✕ retirer. Pour inviter quelqu&apos;un de
            nouveau, utilise plutôt le lien d&apos;invitation.
          </p>
        </>
      )}
      {message && (
        <p
          className={`text-sm font-semibold mt-2 ${
            message.kind === "ok" ? "text-ok" : "text-refuse"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
