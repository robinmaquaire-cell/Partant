// Ce que renvoie la fonction my_lists() de Supabase, et sa conversion
// en options de sélection pour le formulaire d'événement.

export type MyListRow = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  logo_url: string | null;
};

export function listOptionsFrom(rows: MyListRow[]) {
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    emoji: l.emoji,
    logoUrl: l.logo_url,
  }));
}
