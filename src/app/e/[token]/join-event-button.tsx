"use client";

import { useState, useTransition } from "react";
import { joinEvent } from "./actions";

export function JoinEventButton({
  token,
  title,
}: {
  token: string;
  title: string;
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
            const result = await joinEvent(token);
            if (result && !result.ok) setErr(result.error);
          })
        }
        className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
      >
        {pending ? "Un instant…" : `Rejoindre « ${title} »`}
      </button>
      <p className="text-xs mt-2 text-center text-ink-soft">
        Tu pourras ensuite répondre « Partant ! » ou « Pas dispo ».
      </p>
    </div>
  );
}
