"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptContactInvite } from "./actions";

export function AcceptContactButton({
  token,
  pseudo,
  isAlready,
}: {
  token: string;
  pseudo: string;
  isAlready: boolean;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [done, setDone] = useState(isAlready);
  const [pending, startTransition] = useTransition();

  const accept = () =>
    startTransition(async () => {
      setErr("");
      const result = await acceptContactInvite(token);
      if (!result.ok) setErr(result.error);
      else {
        setDone(true);
        router.refresh();
      }
    });

  if (done) {
    return (
      <div className="rounded-2xl p-5 bg-card">
        <div className="font-bold mb-1 text-ok">
          ✓ {pseudo} est dans tes contacts.
        </div>
        <p className="text-sm text-ink-soft">
          Vous vous voyez mutuellement dans votre carnet et pouvez maintenant
          vous inviter à des événements en un clic.
        </p>
        <Link
          href="/contacts"
          className="inline-block mt-3 w-full text-center px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
        >
          Voir mon carnet
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-card">
      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={accept}
        className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
      >
        {pending ? "Un instant…" : `Ajouter ${pseudo} à mes contacts`}
      </button>
      <p className="text-xs mt-2 text-center text-ink-soft">
        L&apos;ajout est réciproque : {pseudo} te verra aussi dans son carnet.
      </p>
    </div>
  );
}
