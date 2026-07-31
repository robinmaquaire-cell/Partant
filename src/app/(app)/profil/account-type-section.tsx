"use client";

import { useState, useTransition } from "react";
import { setAccountType, type AccountType } from "./account-type-actions";

export function AccountTypeSection({
  initial,
}: {
  initial: AccountType;
}) {
  const [current, setCurrent] = useState<AccountType>(initial);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = (type: AccountType) => {
    if (type === current) return;
    startTransition(async () => {
      setMessage(null);
      const result = await setAccountType(type);
      if (result.ok) {
        setCurrent(type);
        setMessage({
          kind: "ok",
          text:
            type === "pro"
              ? "Compte professionnel activé. Les fonctionnalités arrivent prochainement."
              : "Retour au compte personnel.",
        });
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  };

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <h3 className="font-extrabold font-display">🎫 Type de compte</h3>
      <p className="text-sm mt-1 mb-3 text-ink-soft">
        Un compte <strong>professionnel</strong> est pensé pour les
        organisateurs qui proposent régulièrement des activités (guide,
        association, animateur…). Les fonctionnalités dédiées (catalogue,
        page publique, événements ouverts à l&apos;inscription) arrivent
        prochainement — active-le dès aujourd&apos;hui pour être prêt·e.
      </p>

      <div className="flex gap-2">
        {(
          [
            { v: "perso" as const, label: "🙂 Personnel" },
            { v: "pro" as const, label: "💼 Professionnel" },
          ]
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            disabled={pending}
            onClick={() => choose(o.v)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border-[1.5px] disabled:opacity-60 ${
              current === o.v
                ? "bg-ink text-paper border-ink"
                : "text-ink-soft border-line"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

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
