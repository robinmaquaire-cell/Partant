"use client";

import { useState, useTransition } from "react";
import { signOut, updateProfile } from "./actions";

export function ProfileForm({
  initial,
}: {
  initial: {
    pseudo: string;
    contact: string;
    emailNotifications: boolean;
  };
}) {
  const [pseudo, setPseudo] = useState(initial.pseudo);
  const [contact, setContact] = useState(initial.contact);
  const [emails, setEmails] = useState(initial.emailNotifications);
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
        contact,
        emailNotifications: emails,
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
          Ton adresse e-mail
        </div>
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="camille@exemple.fr"
        />
      </label>

      <div className="rounded-2xl p-3 mb-3 bg-card border-[1.5px] border-line">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-bold text-ink text-left"
          onClick={() => setEmails(!emails)}
        >
          <span className="text-lg">{emails ? "☑" : "☐"}</span>
          Me prévenir par e-mail
        </button>
        <p className="text-xs mt-1 text-ink-soft">
          {emails
            ? "Tu reçois un e-mail à la création d'un événement et un rappel la veille."
            : "Tu ne recevras aucun e-mail. Pour suivre les événements, ouvre l'application ou branche ton calendrier (onglet Calendrier)."}
        </p>
      </div>

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
