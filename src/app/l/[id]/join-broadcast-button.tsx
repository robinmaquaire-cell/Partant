"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinBroadcastList,
  leaveBroadcastList,
} from "@/app/(app)/contacts/(hub)/listes/actions";

export function JoinBroadcastButton({
  listId,
  listName,
  isMember,
}: {
  listId: string;
  listName: string;
  isMember: boolean;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const join = () =>
    startTransition(async () => {
      setErr("");
      const result = await joinBroadcastList(listId);
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });

  const leave = () =>
    startTransition(async () => {
      setErr("");
      if (
        !window.confirm(
          "Quitter cette liste ? Tu ne recevras plus les prochains événements."
        )
      )
        return;
      const result = await leaveBroadcastList(listId);
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });

  return (
    <div className="rounded-2xl p-5 bg-card">
      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}
      {isMember ? (
        <>
          <p className="text-sm font-semibold mb-2 text-ok">
            ✓ Tu es inscrit·e à cette liste.
          </p>
          <button
            disabled={pending}
            onClick={leave}
            className="w-full px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 disabled:opacity-60"
          >
            {pending ? "Un instant…" : "Quitter la liste"}
          </button>
        </>
      ) : (
        <button
          disabled={pending}
          onClick={join}
          className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
        >
          {pending ? "Un instant…" : `Rejoindre « ${listName} »`}
        </button>
      )}
    </div>
  );
}
