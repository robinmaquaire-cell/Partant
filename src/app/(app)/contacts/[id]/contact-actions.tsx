"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeContact, setContactBlocked } from "../actions";

// Bloquer/débloquer et retirer un contact, depuis sa fiche.
export function ContactActions({
  contactId,
  blocked,
}: {
  contactId: string;
  blocked: boolean;
}) {
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      setErr("");
      const result = await setContactBlocked(contactId, !blocked);
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      setErr("");
      const result = await removeContact(contactId);
      if (!result.ok) {
        setErr(result.error);
        setConfirmRemove(false);
      } else {
        router.push("/contacts");
      }
    });

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className={`flex-1 py-2.5 rounded-xl font-bold border-[1.5px] disabled:opacity-60 ${
            blocked ? "text-ok border-ok/50" : "text-ink-soft border-line"
          }`}
        >
          {blocked ? "Débloquer ses événements" : "Bloquer ses événements"}
        </button>
        {confirmRemove ? (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="px-4 py-2.5 rounded-xl font-bold text-white bg-refuse disabled:opacity-60"
          >
            Confirmer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40"
          >
            Retirer
          </button>
        )}
      </div>
      <p className="text-xs mt-1.5 text-ink-soft">
        {blocked
          ? "Ses événements n'apparaissent plus dans ton fil ni ton calendrier."
          : "Bloquer masque ses événements de ton fil et de ton calendrier (sans le prévenir)."}
      </p>
      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
