// Bloc « Point de rendez-vous » : un lien unique vers le lieu, au format
// Google Maps universel (reconnu comme une adresse ; ouvre l'application
// Google Maps par défaut sur téléphone, sinon la carte dans le navigateur).
// Avec les coordonnées GPS on ouvre le point exact ; sinon on lance une
// recherche sur le texte du lieu.

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

  const query = hasCoords ? `${lat},${lng}` : text.trim();
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line transition-transform active:scale-[0.99]"
    >
      <span className="text-xl leading-none shrink-0">📍</span>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold font-display">Point de rendez-vous</div>
        {text.trim() && (
          <div className="text-sm text-ink-soft truncate">{text}</div>
        )}
        <div className="text-sm font-bold text-river">Ouvrir dans Maps ↗</div>
      </div>
    </a>
  );
}
