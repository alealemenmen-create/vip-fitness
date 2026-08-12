// Service worker minimo: solo recibe pushes y los muestra como notificacion
// del sistema. No cachea nada ni intercepta fetch — el aviso de fin de
// descanso es lo unico que necesita, no un modo offline completo.

// Mismo patron que la vibracion local de `avisarFinDescanso` (aviso.ts):
// tres pares de golpes cortos. En Android/Chrome esto lo respeta el sistema;
// en iOS Safari el vibrado de un push web es fijo por plataforma y este campo
// no tiene efecto, pero no está de más declararlo.
const VIBRACION = [260, 120, 260, 120, 260, 340, 260, 120, 260, 120, 260, 340, 400];

// Sin esto, una versión nueva del service worker queda "esperando" hasta que
// el alumno cierre la app por completo — en un teléfono eso puede ser nunca, y
// un arreglo de las notificaciones tardaría semanas en llegarle. Acá es seguro
// tomar el control de inmediato porque este worker NO intercepta `fetch` ni
// cachea nada: no hay riesgo de mezclar assets viejos con nuevos.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
  const destino = (event.notification.data && event.notification.data.url) || "/";
  // Absoluta y contra el origen del service worker: `openWindow` con una ruta
  // relativa puede resolverse fuera del alcance de la app instalada y abrirse
  // en el navegador, como si fuera un enlace externo, en vez de dentro de VIP.
  const url = new URL(destino, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        // Antes solo se hacía `focus()` y la URL se descartaba: el aviso
        // decía "ciérrala" pero dejaba al alumno en la pantalla donde
        // estuviera, sin llevarlo a la sesión. Se navega la ventana que ya
        // existe y recién si eso no se puede, se enfoca a secas.
        if ("navigate" in ventana) {
          return ventana
            .navigate(url)
            .then((navegada) => (navegada && "focus" in navegada ? navegada.focus() : undefined))
            .catch(() => ("focus" in ventana ? ventana.focus() : undefined));
        }
        if ("focus" in ventana) return ventana.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
