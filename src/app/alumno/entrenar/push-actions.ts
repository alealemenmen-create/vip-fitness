"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
// El envío en sí vive en `lib/push/enviar.ts`: este archivo es "use server" y
// no puede exportar ayudantes no-async, pero los avisos de Arena VIP (que
// dispara el entrenador, no el alumno) necesitan la misma maquinaria.
import { enviarPush, vapidListo } from "@/lib/push/enviar";

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

/** Retira únicamente este navegador. El permiso del sistema operativo puede
 * seguir concedido, pero VIP Fitness deja de enviar a ese endpoint. */
export async function eliminarSuscripcionPush(endpoint: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !endpoint) return;
  await createAdminClient().from("push_suscripciones").delete().eq("alumno_id", alumnoId).eq("endpoint", endpoint);
}

async function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      url: `/portal-v2/entrenamiento/sesion?id=${sesionId}`,
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
 * Usada por la sesión clásica (V1). La sesión V2 usa
 * `programarAvisoAusenciaDescansoV2` en su lugar -- ver el comentario de esa
 * función para por qué son dos funciones distintas y no una compartida.
 *
 * Limitación conocida y aceptada: si el alumno cancela el descanso antes de
 * tiempo, este aviso programado no se puede cancelar (no hay un canal para
 * eso sin sumar una cola externa) — en el peor caso llega una notificación
 * de más, ya vencida. Preferible a la alternativa de no avisar nunca.
 */
export async function programarAvisoDescanso(segundos: number, sesionId?: string): Promise<void> {
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
      tag: sesionId ? `fin-descanso-${sesionId}` : "fin-descanso",
      url: sesionId
        ? `/portal-v2/entrenamiento/sesion?id=${encodeURIComponent(sesionId)}`
        : "/portal-v2/entrenamiento",
    };
    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  });
}

/**
 * Programa un único aviso de "sigues de descanso" para dentro de 4 minutos
 * -- solo para la sesión V2.
 *
 * A diferencia de `programarAvisoDescanso` (V1), que se llama al arrancar el
 * descanso y espera la duración configurada, esta se llama SOLO cuando la
 * pestaña/PWA pasa a segundo plano de verdad con un descanso pendiente
 * (`visibilitychange` en el cliente, ver `SesionActivaV2.tsx`). La versión
 * anterior de este aviso en V2 reusaba `programarAvisoDescanso` tal cual, y
 * eso mandaba el push aunque el alumno siguiera activo en la app -- reporte
 * real: Diego Cerna lo recibió en plena serie 4, con la pantalla abierta.
 * "4 minutos" acá mide ausencia real de la app, no la duración del
 * descanso. Alejandro pidió expresamente un solo aviso, no dos: cada push
 * enviado cuesta cuota.
 *
 * Limitación conocida y aceptada: si el alumno vuelve a la app antes de los
 * 4 minutos, este aviso programado no se puede cancelar (no hay un canal
 * para eso sin sumar una cola externa) -- en el peor caso llega una
 * notificación de más, ya vencida. Mucho menos frecuente que antes, porque
 * ahora solo se programa cuando de verdad salió, no siempre.
 */
const ESPERA_AUSENCIA_SEGUNDOS = 4 * 60;

export async function programarAvisoAusenciaDescansoV2(sesionId?: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;
  if (!vapidListo()) return;

  const admin = createAdminClient();
  const { data: suscripciones } = await admin
    .from("push_suscripciones")
    .select("endpoint, p256dh, auth")
    .eq("alumno_id", alumnoId);
  if (!suscripciones || suscripciones.length === 0) return;

  after(async () => {
    await esperar(ESPERA_AUSENCIA_SEGUNDOS * 1000);
    const payload = {
      title: "Sigues de descanso",
      body: "Ya pasaron unos minutos fuera de la app. Vuelve para tu siguiente serie.",
      tag: sesionId ? `fin-descanso-${sesionId}` : "fin-descanso",
      url: sesionId
        ? `/portal-v2/entrenamiento/sesion?id=${encodeURIComponent(sesionId)}`
        : "/portal-v2/entrenamiento",
    };
    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  });
}
