"use client";

import { useState, useTransition } from "react";
import { joinList } from "./actions";

export function JoinButton({
  token,
  listName,
}: {
  token: string;
  listName: string;
}) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl p-5 bg-card">
      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinList(token);
            if (result && !result.ok) setErr(result.error);
          })
        }
        className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
      >
        {pending ? "Un instant…" : `Rejoindre « ${listName} »`}
      </button>
    </div>
  );
}
