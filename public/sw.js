// Service worker de Partant ? — deux rôles :
// 1) rendre l'application installable (sans rien mettre en cache : le
//    réseau reste la seule source de vérité, pas de données périmées) ;
// 2) recevoir et afficher les notifications push.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // Réseau direct, volontairement.
});

// Une notification push arrive (nouvel événement, rappel de la veille…).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Partants ?", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Partants ?";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Regrouper par événement : une nouvelle notif remplace la précédente.
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Toucher la notification ouvre l'application sur la bonne page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenêtre de l'app est déjà ouverte, on la réutilise.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
