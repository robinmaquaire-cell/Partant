"use client";

import { useState, useTransition } from "react";
import { signOut, updateProfile } from "./actions";

const MODES = [
  { id: "email", label: "E-mail" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "sms", label: "SMS" },
] as const;

export function ProfileForm({
  initial,
}: {
  initial: { pseudo: string; contactMode: string; contact: string };
}) {
  const [pseudo, setPseudo] = useState(initial.pseudo);
  const [mode, setMode] = useState(initial.contactMode);
  const [contact, setContact] = useState(initial.contact);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [saving, startSaving] = useTransition();
  const [leaving, startLeaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const result = await updateProfile({
        pseudo,
        contactMode: mode,
        contact,
      });
      setMessage(
        result.ok
          ? { kind: "ok", text: "Profil enregistré ✓" }
          : { kind: "error", text: result.error }
      );
    });

  const inputClass =
    "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

  return (
    <div>
      <h2 className="text-xl font-extrabold mb-4 font-display">Mon profil</h2>

      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Pseudo
        </div>
        <input
          className={inputClass}
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="ex. Camille"
        />
      </label>

      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Comment te prévenir ?
        </div>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold border-[1.5px] ${
                mode === m.id
                  ? "bg-ink text-paper border-ink"
                  : "text-ink-soft border-line"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode !== "email" && (
          <p className="text-xs mt-1 font-semibold text-refuse">
            ⚠️ Les notifications WhatsApp et SMS ne sont pas encore en service :
            si tu choisis ce mode, tu ne recevras aucune notification. Choisis
            « E-mail » pour être prévenu·e.
          </p>
        )}
      </label>

      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          {mode === "email" ? "Ton adresse e-mail" : "Ton numéro"}
        </div>
        <input
          className={inputClass}
          type={mode === "email" ? "email" : "tel"}
          inputMode={mode === "email" ? "email" : "tel"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={mode === "email" ? "camille@exemple.fr" : "06 12 34 56 78"}
        />
      </label>

      {message && (
        <p
          className={`text-sm font-semibold mb-2 ${
            message.kind === "ok" ? "text-ok" : "text-refuse"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95 disabled:opacity-60"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      <div className="mt-8">
        <button
          onClick={() => startLeaving(() => signOut())}
          disabled={leaving}
          className="w-full px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 transition-transform active:scale-95 disabled:opacity-60"
        >
          {leaving ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}
