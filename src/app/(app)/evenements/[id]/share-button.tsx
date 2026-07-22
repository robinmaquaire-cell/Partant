"use client";

import { useState } from "react";

// Bouton « Partager » en haut de la page d'un événement : ouvre le partage
// natif du téléphone (WhatsApp, SMS, e-mail…) ou copie le lien.
// Le lien mène à l'événement et permet de créer un compte au passage.
export function ShareButton({
  path,
  title,
  withInvite,
}: {
  path: string; // « /e/<jeton> » si un lien d'invitation existe, sinon « / »
  title: string;
  withInvite: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    const text = withInvite
      ? `Partant ? « ${title} » — rejoins-nous :`
      : `Partant ? — l'appli où on organise nos sorties :`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Partant ? — ${title}`, text, url });
        return;
      } catch {
        // Partage annulé ou refusé : on retombe sur la copie.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setManual(url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line bg-card transition-transform active:scale-95"
      >
        {copied ? "Lien copié ✓" : "🔗 Partager"}
      </button>
      {manual && (
        <p className="text-xs mt-1 font-semibold text-ink-soft break-all">
          Copie ce lien : {manual}
        </p>
      )}
    </>
  );
}
