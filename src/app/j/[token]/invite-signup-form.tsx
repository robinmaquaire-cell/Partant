"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteSignupForm({
  token,
  listName,
}: {
  token: string;
  listName: string;
}) {
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!pseudo.trim()) {
      setErr("Renseigne un pseudo.");
      return;
    }
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setErr("Cette adresse e-mail n'est pas valide.");
      return;
    }
    setErr("");
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/j/${token}`,
        data: { pseudo: pseudo.trim() },
      },
    });
    setSending(false);
    if (error) {
      setErr("L'envoi a échoué. Réessaie dans une minute.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl p-5 bg-card">
        <div className="font-bold mb-1">📬 Plus qu&apos;une étape !</div>
        <p className="text-sm text-ink-soft">
          Ouvre l&apos;e-mail reçu sur <strong>{email.trim()}</strong> et
          clique sur le lien : ton compte sera créé et tu pourras rejoindre «{" "}
          {listName} ». Ouvre-le sur cet appareil, avec ce navigateur.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-card">
      <label className="block mb-3">
        <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
          Ton pseudo
        </div>
        <input
          className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river"
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
          type="email"
          inputMode="email"
          autoComplete="email"
          className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="camille@exemple.fr"
        />
      </label>
      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}
      <button
        onClick={send}
        disabled={sending}
        className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
      >
        {sending ? "Envoi…" : "Créer mon compte et rejoindre"}
      </button>
      <p className="text-xs mt-3 text-center text-ink-soft">
        Pas de mot de passe : tu recevras un lien magique par e-mail. En
        continuant, tu acceptes les conditions d&apos;utilisation.
      </p>
    </div>
  );
}
