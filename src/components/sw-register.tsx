"use client";

import { useEffect } from "react";

// Enregistre le service worker (nécessaire pour l'installation PWA).
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Pas bloquant : l'application fonctionne aussi sans.
      });
    }
  }, []);
  return null;
}
