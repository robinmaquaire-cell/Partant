// Service worker minimal : il rend l'application installable sans rien
// mettre en cache (le réseau reste la seule source de vérité — pas de
// risque d'afficher des données périmées).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // Réseau direct, volontairement.
});
