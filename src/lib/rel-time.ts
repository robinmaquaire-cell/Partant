// Compte à rebours en français : « Aujourd'hui », « Demain », « Dans 5 jours »…
// (repris du prototype validé)
export function relTime(date: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff > 1 && diff < 7) return "Dans " + diff + " jours";
  if (diff >= 7 && diff < 30) return "Dans " + Math.round(diff / 7) + " sem.";
  if (diff >= 30) return "Dans " + Math.round(diff / 30) + " mois";
  return "Passé";
}
