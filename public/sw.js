// Service worker minimo: solo recibe pushes y los muestra como notificacion
// del sistema. No cachea nada ni intercepta fetch — el aviso de fin de
// descanso es lo unico que necesita, no un modo offline completo.

// Mismo patron que la vibracion local de `avisarFinDescanso` (aviso.ts):
// tres pares de golpes cortos. En Android/Chrome esto lo respeta el sistema;
// en iOS Safari el vibrado de un push web es fijo por plataforma y este campo
// no tiene efecto, pero no está de más declararlo.
const VIBRACION = [260, 120, 260, 120, 260, 340, 260, 120, 260, 120, 260, 340, 400];

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
    vibrate: VIBRACION,
    // Sin esto, si ya hay una notificación con el mismo tag sin abrir (pasó
    // el descanso de otro ejercicio y todavía no la viste), la siguiente la
    // reemplaza en silencio — sin vibrar ni sonar de nuevo.
    renotify: true,
    requireInteraction: true,
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
