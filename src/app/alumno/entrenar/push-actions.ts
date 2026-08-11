"use server";

import { after } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";

// A proposito NO se llama a nivel de modulo: `setVapidDetails` tira una
// excepcion sincronica si falta cualquiera de las dos claves, y eso rompia
// TODA la pagina de sesion en produccion (cualquier accion la importa
// transitivamente) durante la ventana en la que las claves todavia no
// estaban cargadas en Vercel. Se llama recien dentro de cada funcion, solo
// cuando ambas claves existen de verdad.
function vapidListo(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function configurarVapid(): void {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "soporte@vipfitness.cl"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
}

/** Guarda (o actualiza) la suscripción push de este alumno — se llama sola
 * apenas acepta el permiso de notificaciones, ver `asegurarSuscripcionPush`
 * en `lib/entrenamiento/push.ts`. El endpoint es único por dispositivo/
 * navegador, así que un mismo alumno puede tener varias filas (celular +
 * compu) y todas reciben el aviso. */
export async function guardarSuscripcionPush(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !sub.endpoint || !sub.p256dh || !sub.auth) return;

  const supabase = await createClient();
  await supabase.from("push_suscripciones").upsert(
    {
      alumno_id: alumnoId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" }
  );
}

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Manda el push a una suscripción puntual. Si el navegador la dio de baja
 * (404/410 — el usuario desinstaló la PWA, revocó el permiso, etc.) borra la
 * fila para no seguir intentando en vano las próximas veces. */
async function enviarPush(
  admin: ReturnType<typeof createAdminClient>,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag: string; url: string }
): Promise<void> {
  try {
    configurarVapid();
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
  } catch (error) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    if (status === 404 || status === 410) {
      await admin.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
    }
  }
}

/**
 * Programa el recordatorio de "dejaste el entrenamiento sin cerrar".
 *
 * Es el arreglo del problema más caro del panel del alumno: se van a Ranked, a
 * Nutrición o directamente cierran la app, la sesión queda `en_progreso` para
 * siempre, no suma puntos y encima le tapa el paso a la siguiente. Dentro de la
 * app ya avisa `SalidaGuiadaSesion`; esto cubre lo que la app no puede — al
 * alumno que ya no la tiene abierta.
 *
 * Diferencia importante con el aviso de descanso: acá **se vuelve a mirar la
 * base antes de mandar nada**. Si mientras tanto cerró la sesión (o la
 * abandonó, o la canceló), el aviso no sale. Nunca llega un "complétala"
 * de una rutina que ya está completa.
 *
 * El texto cambia según lo que dejó hecho, porque no es lo mismo pedirle que
 * cierre algo que ya terminó que pedirle que vuelva a mitad de camino.
 *
 * **La espera NO puede pasar de `maxDuration`** (300s en la página de sesión,
 * ver `sesion/[id]/page.tsx`): `after()` corre dentro de la misma invocación,
 * así que una espera más larga la corta la plataforma y el aviso no sale
 * nunca. Por eso 240s y no los 12 minutos que parecerían más razonables —
 * subir el techo es un cambio de plataforma, no de este archivo. Quedan 60s
 * de margen para las dos consultas y el envío.
 */
export async function programarAvisoSesionSinCerrar(
  sesionId: string,
  segundos = 240
): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !sesionId) return;
  if (!vapidListo()) return;

  const admin = createAdminClient();
  const { data: suscripciones } = await admin
    .from("push_suscripciones")
    .select("endpoint, p256dh, auth")
    .eq("alumno_id", alumnoId);
  if (!suscripciones || suscripciones.length === 0) return;

  after(async () => {
    await esperar(segundos * 1000);

    // La sesión tiene que seguir abierta Y seguir siendo de este alumno.
    const { data: sesion } = await admin
      .from("sesiones_entrenamiento")
      .select("id, estado")
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId)
      .eq("estado", "en_progreso")
      .maybeSingle();
    if (!sesion) return;

    const { data: ejercicios } = await admin
      .from("sesion_ejercicios")
      .select("completado")
      .eq("sesion_id", sesionId);
    const total = ejercicios?.length ?? 0;
    const completados = ejercicios?.filter((e) => e.completado).length ?? 0;
    // Sin nada hecho no se molesta a nadie: lo más probable es que haya
    // abierto el día para mirarlo, no que haya entrenado y se le olvidara.
    if (completados === 0) return;

    const termino = total > 0 && completados >= total;
    const payload = {
      title: termino ? "Terminaste tu rutina" : "Dejaste tu entrenamiento a medias",
      body: termino
        ? "Te falta cerrarla para que se sumen tus Puntos VIP."
        : `Llevas ${completados} de ${total} ejercicios. Ciérrala para no perder el registro.`,
      tag: `sesion-sin-cerrar-${sesionId}`,
      url: `/alumno/entrenar/sesion/${sesionId}`,
    };
    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  });
}

/**
 * Programa el aviso de "se acabó el descanso" para dentro de `segundos`.
 *
 * Por qué esto y no un `setInterval` en el navegador: iOS suspende la
 * ejecución de JS de la pestaña/PWA apenas pasa a segundo plano (cambiar de
 * app, bloquear pantalla), así que un temporizador local nunca llega a
 * disparar el aviso mientras el alumno no está mirando la app. Acá el
 * "temporizador" vive en el servidor via `after()` (se ejecuta después de
 * responder, sin bloquear al alumno) y el push lo entrega el sistema
 * operativo — eso sí sobrevive a la pantalla bloqueada.
 *
 * Limitación conocida y aceptada: si el alumno cancela el descanso antes de
 * tiempo, este aviso programado no se puede cancelar (no hay un canal para
 * eso sin sumar una cola externa) — en el peor caso llega una notificación
 * de más, ya vencida. Preferible a la alternativa de no avisar nunca.
 */
export async function programarAvisoDescanso(segundos: number): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !segundos || segundos <= 0) return;
  if (!vapidListo()) return;

  const admin = createAdminClient();
  const { data: suscripciones } = await admin
    .from("push_suscripciones")
    .select("endpoint, p256dh, auth")
    .eq("alumno_id", alumnoId);
  if (!suscripciones || suscripciones.length === 0) return;

  after(async () => {
    await esperar(segundos * 1000);
    const payload = {
      title: "Se acabó el descanso",
      body: "Vuelve a la app para tu siguiente serie.",
      tag: "fin-descanso",
      url: "/alumno/entrenar",
    };
    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  });
}
