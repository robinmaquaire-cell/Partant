"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ erreur }: { erreur?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(
    erreur === "lien-invalide"
      ? "Ce lien de connexion est invalide ou a expiré. Demande-en un nouveau."
      : ""
  );

  const send = async () => {
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
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setSending(false);
    if (error) {
      setErr(
        "L'envoi a échoué. Réessaie dans une minute — si ça persiste, le service d'e-mail est peut-être saturé."
      );
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl p-5 bg-card">
        <div className="font-bold mb-1">📬 C&apos;est envoyé !</div>
        <p className="text-sm text-ink-soft">
          Ouvre l&apos;e-mail reçu sur <strong>{email.trim()}</strong> et
          clique sur le lien de connexion. Tu peux fermer cette page.
        </p>
        <button
          className="mt-3 text-sm font-bold text-river underline"
          onClick={() => setSent(false)}
        >
          Modifier l&apos;adresse
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-card">
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
        {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
      <p className="text-xs mt-3 text-center text-ink-soft">
        Pas de mot de passe : on t&apos;envoie un lien magique par e-mail. En
        continuant, tu acceptes les{" "}
        <a href="/conditions" className="underline">
          conditions d&apos;utilisation
        </a>
        .
      </p>
    </div>
  );
}
