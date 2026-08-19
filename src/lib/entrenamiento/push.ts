/**
 * Suscripción a Web Push, para que el aviso de fin de descanso llegue con la
 * pantalla bloqueada o la app en otra pestaña (ver `programarAvisoDescanso`
 * en `app/alumno/entrenar/push-actions.ts` — ese es el motivo real de que
 * esto exista: un temporizador del navegador no sobrevive a eso).
 *
 * Se llama sola desde `prepararAviso` (aviso.ts) apenas el permiso de
 * notificaciones queda en "granted" — no hace falta un botón aparte.
 */

/** La Push API pide la clave VAPID como Uint8Array, no como el string base64
 * que da `web-push generate-vapid-keys`. Conversión estándar de la
 * documentación de la Push API. */
function claveComoUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Normalizado = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(base64Normalizado);
  const salida = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

export async function asegurarSuscripcionPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;
    const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!clavePublica) return;

    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveComoUint8Array(clavePublica),
      });
    }

    const json = suscripcion.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    // Import dinámico: este archivo lo importa `aviso.ts`, que a su vez lo
    // usa `SesionEjercicioCard` — mantener la server action fuera del
    // bundle inicial hasta que de verdad haga falta mandarla.
    const { guardarSuscripcionPush } = await import("@/app/alumno/entrenar/push-actions");
    await guardarSuscripcionPush({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
  } catch {
    // Sin push disponible (navegador viejo, PWA no instalada, permiso
    // denegado), el aviso local — vibración/sonido/notificación mientras la
    // app sigue en pantalla — sigue funcionando igual.
  }
}

export async function suscripcionPushActiva(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registro = await navigator.serviceWorker.getRegistration("/sw.js") ?? await navigator.serviceWorker.getRegistration();
  return Boolean(await registro?.pushManager.getSubscription());
}

export async function desactivarSuscripcionPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registro = await navigator.serviceWorker.getRegistration("/sw.js") ?? await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;
  const { eliminarSuscripcionPush } = await import("@/app/alumno/entrenar/push-actions");
  await eliminarSuscripcionPush(suscripcion.endpoint);
  await suscripcion.unsubscribe();
}
