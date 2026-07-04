/* Service Worker — Web Push da Órbita.
   Exibe notificações do sistema fora do app (Windows/mobile) e foca/abre a
   janela ao clicar. Payload esperado: { title, body, url, tag }. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Notificação", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Notificação";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    badge: "/icon-badge.png",
    icon: "/icon-192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
