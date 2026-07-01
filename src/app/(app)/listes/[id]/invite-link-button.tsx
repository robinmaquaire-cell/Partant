"use client";

import { useState, useTransition } from "react";
import { regenerateInvite } from "./actions";

export function InviteLinkButton({
  token,
  isAdmin,
  listId,
}: {
  token: string;
  isAdmin: boolean;
  listId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    const url = `${window.location.origin}/j/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Navigateurs anciens : on affiche le lien pour copie manuelle.
      setMessage(`Copie ce lien : ${url}`);
    }
  };

  const regenerate = () =>
    startTransition(async () => {
      if (
        !window.confirm(
          "Créer un nouveau lien ? L'ancien lien d'invitation ne fonctionnera plus."
        )
      )
        return;
      const result = await regenerateInvite(listId);
      setMessage(result.ok ? result.info ?? "" : result.error);
    });

  return (
    <div className="mb-2">
      <button
        onClick={copy}
        className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
      >
        {copied ? "Lien copié ✓" : "🔗 Copier le lien d'invitation"}
      </button>
      <p className="text-xs mt-1 text-center text-ink-soft">
        Envoie ce lien à qui tu veux : il permet de rejoindre la liste (et de
        créer un compte au passage).
      </p>
      {isAdmin && (
        <button
          onClick={regenerate}
          disabled={pending}
          className="w-full mt-1 text-xs font-bold text-refuse underline disabled:opacity-60"
        >
          {pending ? "Création…" : "Révoquer et créer un nouveau lien"}
        </button>
      )}
      {message && (
        <p className="text-xs mt-1 text-center font-semibold text-ink-soft break-all">
          {message}
        </p>
      )}
    </div>
  );
}
