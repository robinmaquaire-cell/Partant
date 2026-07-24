// Bloc « Point de rendez-vous » : ouvre le lieu dans l'appli de navigation
// du choix de la personne (Google Maps, Plans/Apple, Komoot, OpenStreetMap).
// Si on a les coordonnées GPS on ouvre le point exact ; sinon on lance une
// recherche sur le texte du lieu.

type MapApp = { label: string; emoji: string; href: string };

export function LocationActions({
  lat,
  lng,
  text,
}: {
  lat: number | null;
  lng: number | null;
  text: string;
}) {
  const hasCoords = lat !== null && lng !== null;
  if (!hasCoords && !text.trim()) return null;

  const q = encodeURIComponent(text.trim() || `${lat},${lng}`);
  const apps: MapApp[] = hasCoords
    ? [
        {
          label: "Google Maps",
          emoji: "🗺️",
          href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        },
        {
          label: "Plans",
          emoji: "🍎",
          href: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
        },
        {
          label: "Komoot",
          emoji: "🥾",
          href: `https://www.komoot.com/plan/@${lat},${lng},15z`,
        },
        {
          label: "OpenStreetMap",
          emoji: "🌍",
          href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
        },
      ]
    : [
        {
          label: "Google Maps",
          emoji: "🗺️",
          href: `https://www.google.com/maps/search/?api=1&query=${q}`,
        },
        {
          label: "Plans",
          emoji: "🍎",
          href: `https://maps.apple.com/?q=${q}`,
        },
      ];

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
      <div className="text-xs font-bold uppercase tracking-wide mb-1.5 text-ink-soft">
        Ouvrir l&apos;itinéraire dans
      </div>
      <div className="flex gap-2 flex-wrap">
        {apps.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl text-sm font-bold text-ink border-[1.5px] border-line bg-paper transition-transform active:scale-95"
          >
            {a.emoji} {a.label}
          </a>
        ))}
      </div>
    </div>
  );
}
