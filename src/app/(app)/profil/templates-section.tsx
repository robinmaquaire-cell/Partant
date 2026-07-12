"use client";

import { useState, useTransition } from "react";
import { deleteTemplate } from "./actions";

export type TemplateSummary = {
  id: string;
  name: string;
  time: string;
  location: string;
};

export function TemplatesSection({ templates }: { templates: TemplateSummary[] }) {
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = (id: string) =>
    startTransition(async () => {
      setErr("");
      const result = await deleteTemplate(id);
      if (!result.ok) setErr(result.error);
    });

  return (
    <div className="mt-8">
      <h3 className="font-extrabold mb-2 font-display">
        Mes templates d&apos;événements
      </h3>
      {templates.length === 0 && (
        <p className="text-sm mb-2 text-ink-soft">
          Aucun template. Coche « Enregistrer comme template » en créant un
          événement.
        </p>
      )}
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between px-3 py-2 rounded-xl mb-1 bg-card border-[1.5px] border-line"
        >
          <div>
            <div className="font-semibold text-sm">⚡ {t.name}</div>
            <div className="text-xs text-ink-soft">
              {[t.time, t.location].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => remove(t.id)}
            className="text-refuse font-bold px-2 disabled:opacity-60"
            aria-label={`Supprimer le template ${t.name}`}
          >
            ✕
          </button>
        </div>
      ))}
      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
