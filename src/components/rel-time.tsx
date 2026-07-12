"use client";

import { relTime } from "@/lib/rel-time";

// Affiché côté navigateur pour utiliser le fuseau horaire de l'utilisateur.
// suppressHydrationWarning : autour de minuit, le serveur peut avoir calculé
// un jour d'écart — le navigateur corrige silencieusement.
export function RelTime({ date }: { date: string }) {
  return <span suppressHydrationWarning>{relTime(date)}</span>;
}
