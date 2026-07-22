"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";
const labelCls =
  "text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft";

export function LoginForm({ erreur }: { erreur?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"lien" | "motdepasse">("lien");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<"lien" | "reinit" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(
    erreur === "lien-invalide"
      ? "Ce lien de connexion est invalide ou a expiré. Demande-en un nouveau."
      : ""
  );

  const cleanEmail = () => email.trim().toLowerCase();

  const sendMagicLink = async () => {
    const value = cleanEmail();
    if (!EMAIL_RE.test(value)) {
      setErr("Cette adresse e-mail n'est pas valide.");
      return;
    }
    setErr("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) {
      setErr(
        "L'envoi a échoué. Réessaie dans une minute — si ça persiste, le service d'e-mail est peut-être saturé."
      );
      return;
    }
    setSent("lien");
  };

  const signIn = async () => {
    const value = cleanEmail();
    if (!EMAIL_RE.test(value)) {
      setErr("Cette adresse e-mail n'est pas valide.");
      return;
    }
    if (!password) {
      setErr("Saisis ton mot de passe.");
      return;
    }
    setErr("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: value,
      password,
    });
    setBusy(false);
    if (error) {
      setErr(
        /invalid login credentials/i.test(error.message)
          ? "E-mail ou mot de passe incorrect. Si tu n'as jamais choisi de mot de passe, connecte-toi avec un lien magique : tu pourras en créer un dans ton profil."
          : /email not confirmed/i.test(error.message)
            ? "Ton adresse n'est pas encore confirmée : connecte-toi une première fois avec un lien magique."
            : "La connexion a échoué. Réessaie dans un instant."
      );
      return;
    }
    // La session est posée : on recharge pour que le serveur la voie.
    router.push("/");
    router.refresh();
  };

  const resetPassword = async () => {
    const value = cleanEmail();
    if (!EMAIL_RE.test(value)) {
      setErr("Saisis d'abord ton adresse e-mail, puis reclique ici.");
      return;
    }
    setErr("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/profil?mdp=1`,
    });
    setBusy(false);
    if (error) {
      setErr("L'envoi a échoué. Réessaie dans une minute.");
      return;
    }
    setSent("reinit");
  };

  if (sent) {
    return (
      <div className="rounded-2xl p-5 bg-card">
        <div className="font-bold mb-1">📬 C&apos;est envoyé !</div>
        <p className="text-sm text-ink-soft">
          Ouvre l&apos;e-mail reçu sur <strong>{cleanEmail()}</strong> et clique
          sur le lien
          {sent === "reinit"
            ? " : tu pourras choisir un nouveau mot de passe."
            : " de connexion."}{" "}
          Ouvre-le sur cet appareil, avec ce navigateur.
        </p>
        <button
          className="mt-3 text-sm font-bold text-river underline"
          onClick={() => setSent(null)}
        >
          Revenir en arrière
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-card">
      <div className="flex gap-2 mb-4">
        {(
          [
            ["lien", "Lien magique"],
            ["motdepasse", "Mot de passe"],
          ] as const
        ).map(([m, lab]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setErr("");
            }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border-[1.5px] ${
              mode === m
                ? "bg-ink text-paper border-ink"
                : "text-ink-soft border-line"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>

      <label className="block mb-3">
        <div className={labelCls}>Ton adresse e-mail</div>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (mode === "lien" ? sendMagicLink() : signIn())
          }
          placeholder="camille@exemple.fr"
        />
      </label>

      {mode === "motdepasse" && (
        <label className="block mb-3">
          <div className={labelCls}>Ton mot de passe</div>
          <input
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            placeholder="••••••••"
          />
        </label>
      )}

      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}

      <button
        onClick={mode === "lien" ? sendMagicLink : signIn}
        disabled={busy}
        className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
      >
        {busy
          ? "Un instant…"
          : mode === "lien"
            ? "Recevoir mon lien de connexion"
            : "Se connecter"}
      </button>

      {mode === "motdepasse" && (
        <button
          type="button"
          onClick={resetPassword}
          disabled={busy}
          className="w-full mt-2 text-xs font-bold underline text-ink-soft disabled:opacity-60"
        >
          Mot de passe oublié ?
        </button>
      )}

      <p className="text-xs mt-3 text-center text-ink-soft">
        {mode === "lien"
          ? "Sans mot de passe : on t'envoie un lien à cliquer, valable une fois."
          : "Le mot de passe se choisit dans ton profil, une fois connecté."}{" "}
        En continuant, tu acceptes les{" "}
        <a href="/conditions" className="underline">
          conditions d&apos;utilisation
        </a>
        .
      </p>
    </div>
  );
}
