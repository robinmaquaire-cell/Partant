"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Choisir (ou changer) son mot de passe, pour pouvoir se connecter
// sans attendre un lien magique par e-mail.
export function PasswordSection({ highlight = false }: { highlight?: boolean }) {
  const [open, setOpen] = useState(highlight);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const save = async () => {
    if (password.length < 8) {
      setMessage({
        kind: "error",
        text: "Choisis un mot de passe d'au moins 8 caractères.",
      });
      return;
    }
    if (password !== confirm) {
      setMessage({
        kind: "error",
        text: "Les deux mots de passe ne sont pas identiques.",
      });
      return;
    }
    setMessage(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage({
        kind: "error",
        text: /should be different/i.test(error.message)
          ? "C'est déjà ton mot de passe actuel."
          : "L'enregistrement a échoué. Réessaie dans un instant.",
      });
      return;
    }
    setPassword("");
    setConfirm("");
    setMessage({
      kind: "ok",
      text: "Mot de passe enregistré ✓ Tu peux maintenant te connecter avec ton e-mail et ce mot de passe.",
    });
  };

  const inputCls =
    "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

  return (
    <div
      className={`rounded-2xl p-4 mb-4 bg-card border-[1.5px] ${
        highlight ? "border-signal" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold font-display">🔑 Mon mot de passe</h3>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-bold underline text-ink-soft shrink-0"
          >
            Choisir / changer
          </button>
        )}
      </div>
      <p className="text-sm mt-1 text-ink-soft">
        {highlight
          ? "Choisis ton nouveau mot de passe ci-dessous."
          : "Facultatif : avec un mot de passe, tu te connectes directement, sans attendre l'e-mail. Le lien magique continue de fonctionner."}
      </p>

      {open && (
        <div className="mt-3">
          <label className="block mb-2">
            <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
              Nouveau mot de passe
            </div>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
            />
          </label>
          <label className="block mb-2">
            <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
              Le même, pour vérifier
            </div>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="••••••••"
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95 disabled:opacity-60"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            {!highlight && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMessage(null);
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
