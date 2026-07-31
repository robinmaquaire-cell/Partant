"use client";

import { useState, useTransition } from "react";
import { leaveList } from "./actions";

export function LeaveListButton({
  listId,
  lastMember,
}: {
  listId: string;
  lastMember: boolean;
}) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const leave = () =>
    startTransition(async () => {
      const confirmText = lastMember
        ? "Tu es le·la dernier·ère membre : quitter supprimera le groupe. Continuer ?"
        : "Quitter ce groupe ? Tu ne verras plus ses événements.";
      if (!window.confirm(confirmText)) return;
      const result = await leaveList(listId);
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div>
      <button
        onClick={leave}
        disabled={pending}
        className="w-full px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 transition-transform active:scale-95 disabled:opacity-60"
      >
        {pending
          ? "Départ…"
          : lastMember
            ? "Quitter et supprimer le groupe"
            : "Quitter le groupe"}
      </button>
      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
