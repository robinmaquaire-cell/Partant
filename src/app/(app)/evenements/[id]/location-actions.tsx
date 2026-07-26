"use client";

import { useState } from "react";

// Bloc « Point de rendez-vous » : trois façons d'utiliser le lieu —
// l'ouvrir sur Google Maps, copier les coordonnées, ou l'ouvrir sur
// OpenStreetMap. Sans coordonnées GPS (lieu en texte seul), on propose
// simplement une recherche sur Google Maps.
export function LocationActions({
  lat,
  lng,
  text,
}: {
  lat: number | null;
  lng: number | null;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const hasCoords = lat !== null && lng !== null;
  if (!hasCoords && !text.trim()) return null;

  const googleHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text.trim())}`;
  const osmHref = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const rowCls =
    "flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-ink border-[1.5px] border-line bg-paper transition-transform active:scale-[0.99]";

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg leading-none">📍</span>
        <div className="min-w-0">
          <div className="font-extrabold font-display">Point de rendez-vous</div>
          {text.trim() && (
            <div className="text-sm text-ink-soft">{text}</div>
          )}
          {hasCoords && (
            <div className="text-xs text-ink-soft">
              {lat}, {lng}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <a href={googleHref} target="_blank" rel="noreferrer" className={rowCls}>
          🗺️ Ouvrir sur Google Maps
        </a>
        {hasCoords && (
          <>
            <button type="button" onClick={copyCoords} className={rowCls}>
              📋 {copied ? "Coordonnées copiées ✓" : "Copier les coordonnées"}
            </button>
            <a href={osmHref} target="_blank" rel="noreferrer" className={rowCls}>
              🌍 Ouvrir sur OpenStreetMap
            </a>
          </>
        )}
      </div>
    </div>
  );
}
