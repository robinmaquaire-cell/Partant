"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveBroadcastList } from "./actions";

export function LeaveSubscriptionButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const leave = () =>
    startTransition(async () => {
      setErr("");
      if (!window.confirm(`Ne plus suivre « ${name} » ?`)) return;
      const result = await leaveBroadcastList(id);
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={leave}
        className="w-full py-1.5 text-sm rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 disabled:opacity-60"
      >
        {pending ? "Retrait…" : "Ne plus suivre"}
      </button>
      {err && (
        <p className="text-xs mt-1 font-semibold text-refuse">{err}</p>
      )}
    </div>
  );
}
