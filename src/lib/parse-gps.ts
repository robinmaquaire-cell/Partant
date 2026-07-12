// Détecte des coordonnées GPS dans un lien Google Maps ou un texte
// « 44.38, 4.42 » (regex reprises du prototype validé).
export function parseGps(text: string): { lat: number; lng: number } | null {
  if (!text) return null;
  let m = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); // lien Google Maps avec @lat,lng
  if (!m) m = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); // lien Google Maps long
  if (!m) m = text.match(/[?&]q=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); // lien ?q=lat,lng
  if (!m) m = text.match(/^\s*(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)\s*$/); // "44.38, 4.42"
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  return { lat: +lat.toFixed(5), lng: +lng.toFixed(5) };
}
