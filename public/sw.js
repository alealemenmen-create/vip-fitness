// Service worker minimo: solo recibe pushes y los muestra como notificacion
// del sistema. No cachea nada ni intercepta fetch — el aviso de fin de
// descanso es lo unico que necesita, no un modo offline completo.

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = {};
  }
  const titulo = datos.title || "VIP Fitness";
  const opciones = {
    body: datos.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: datos.tag || "vip-fitness",
    data: { url: datos.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ("focus" in ventana) return ventana.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
