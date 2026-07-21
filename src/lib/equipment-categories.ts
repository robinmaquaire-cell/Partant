// Catégories proposées par défaut pour classer le matériel d'un événement.
// L'organisateur reste libre d'en taper d'autres.
export const SUGGESTED_CATEGORIES = [
  "Logistique",
  "Sécurité",
  "Nourriture",
  "Technique",
  "Vêtements",
];

// Nom affiché pour le matériel sans catégorie.
export const NO_CATEGORY = "Divers";

// Regroupe des objets par catégorie, « Divers » toujours en dernier.
export function groupByCategory<T extends { category: string | null }>(
  items: T[]
): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = (it.category ?? "").trim() || NO_CATEGORY;
    const bucket = groups.get(key);
    if (bucket) bucket.push(it);
    else groups.set(key, [it]);
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      if (a.category === NO_CATEGORY) return 1;
      if (b.category === NO_CATEGORY) return -1;
      return a.category.localeCompare(b.category, "fr");
    });
}
