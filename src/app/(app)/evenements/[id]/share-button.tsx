"use client";

import { useState } from "react";
import {
  ShareModal,
  type ShareBroadcast,
  type ShareContact,
  type ShareGroup,
} from "./share-modal";
import { siteOrigin } from "@/lib/site-origin";

// Bouton « Partager » en haut de la page d'un événement.
// Pour l'organisateur : ouvre la modale complète (lien + groupes + listes
// de diffusion + contacts avec dispo).
// Pour les autres participants : partage natif du système (WhatsApp, SMS,
// e-mail…), ou copie du lien en dernier recours.
export function ShareButton({
  path,
  title,
  withInvite,
  eventId,
  isOrganizer,
  groups,
  broadcasts,
  contacts,
}: {
  path: string; // « /e/<jeton> » si un lien d'invitation existe, sinon « / »
  title: string;
  withInvite: boolean;
  eventId: string;
  isOrganizer: boolean;
  groups?: ShareGroup[];
  broadcasts?: ShareBroadcast[];
  contacts?: ShareContact[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");

  const shareNatively = async () => {
    const url = `${siteOrigin()}${path}`;
    const text = withInvite
      ? `Partants ? « ${title} » — rejoins-nous :`
      : `Partants ? — l'appli où on organise nos sorties :`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Partants ? — ${title}`, text, url });
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

  const onClick = isOrganizer ? () => setModalOpen(true) : shareNatively;
  const shareUrl = `${siteOrigin()}${path}`;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line bg-card transition-transform active:scale-95"
      >
        {copied ? "Lien copié ✓" : "🔗 Partager"}
      </button>
      {manual && (
        <p className="text-xs mt-1 font-semibold text-ink-soft break-all">
          Copie ce lien : {manual}
        </p>
      )}
      {modalOpen && isOrganizer && (
        <ShareModal
          eventId={eventId}
          shareUrl={shareUrl}
          groups={groups ?? []}
          broadcasts={broadcasts ?? []}
          contacts={contacts ?? []}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
