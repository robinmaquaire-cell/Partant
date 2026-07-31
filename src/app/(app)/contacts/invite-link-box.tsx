"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateContactInviteToken } from "./invite-link-actions";

export function InviteLinkBox({ token }: { token: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(token);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${current}`
      : `/c/${current}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setManual(url);
    }
  };

  const regenerate = () =>
    startTransition(async () => {
      setErr("");
      if (
        !window.confirm(
          "Créer un nouveau lien ? L'ancien lien cessera de fonctionner (les personnes déjà ajoutées restent tes contacts)."
        )
      )
        return;
      const result = await regenerateContactInviteToken();
      if (result.ok) {
        setCurrent(result.token);
        router.refresh();
      } else {
        setErr(result.error);
      }
    });

  return (
    <div className="rounded-2xl p-3 mb-4 bg-card border-[1.5px] border-line">
      <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
        Mon lien d&apos;invitation contact
      </div>
      <button
        type="button"
        onClick={copy}
        className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
      >
        {copied ? "Lien copié ✓" : "🔗 Copier mon lien de contact"}
      </button>
      <p className="text-xs mt-1 text-ink-soft">
        Envoie-le à qui tu veux : en l&apos;ouvrant, la personne devient
        automatiquement ton contact (et toi le sien).
      </p>
      {manual && (
        <p className="text-xs mt-1 text-ink-soft break-all">
          Copie ce lien : {manual}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={regenerate}
        className="w-full mt-1 text-xs font-bold text-refuse underline disabled:opacity-60"
      >
        {pending ? "Création…" : "Révoquer et créer un nouveau lien"}
      </button>
      {err && <p className="text-xs mt-1 font-semibold text-refuse">{err}</p>}
    </div>
  );
}
