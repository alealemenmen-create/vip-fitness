import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PayloadPush = { title: string; body: string; tag: string; url: string };

/**
 * Envío de Web Push compartido.
 *
 * Vive acá y no en `app/alumno/entrenar/push-actions.ts` porque ese archivo es
 * `"use server"`: todo lo que exporta es una server action invocable desde el
 * navegador, así que no puede exportar ayudantes sincrónicos ni ser importado
 * por otras acciones sin arrastrar esa semántica. Los avisos de Arena VIP los
 * dispara el ENTRENADOR (crear/cerrar una competencia), no el alumno, y van a
 * todo el gimnasio: no encajan en aquel archivo.
 */

// A propósito NO se llama a nivel de módulo: `setVapidDetails` tira una
// excepción sincrónica si falta cualquiera de las dos claves, y eso rompería
// toda página que importe esto transitivamente mientras las claves no estén
// cargadas en Vercel.
export function vapidListo(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function configurarVapid(): void {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "soporte@vipfitness.cl"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
}

/** Manda el push a una suscripción puntual. Si el navegador la dio de baja
 * (404/410 — desinstaló la PWA, revocó el permiso) borra la fila para no
 * seguir intentando en vano. */
export async function enviarPush(
  admin: AdminClient,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PayloadPush
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
 * Avisa a TODO el gimnasio (o a los alumnos que se indiquen).
 *
 * Este es el aviso que hacía falta para que Arena VIP dejara de ser "fome": un
 * duelo entre dos personas le importa a dos personas si los otros 66 no se
 * enteran de que existe. Acá se enteran todos.
 *
 * `exceptoAlumnoIds` saca a los que compiten cuando el mensaje es para el
 * público ("ve a apostar"): ellos no pueden apostar en su propio torneo y
 * recibir la invitación sería una burla.
 *
 * Nunca lanza. Un push que no sale no puede tumbar el cierre de un torneo ni
 * dejar la bolsa de premios a medio repartir.
 */
export async function avisarATodosLosAlumnos(
  payload: PayloadPush,
  opciones: { exceptoAlumnoIds?: string[] } = {}
): Promise<void> {
  try {
    if (!vapidListo()) return;
    const admin = createAdminClient();

    const { data: suscripciones } = await admin
      .from("push_suscripciones")
      .select("endpoint, p256dh, auth, alumno_id");
    if (!suscripciones || suscripciones.length === 0) return;

    const excluidos = new Set(opciones.exceptoAlumnoIds ?? []);
    const destinatarias = suscripciones.filter((s) => !excluidos.has(s.alumno_id));
    if (destinatarias.length === 0) return;

    await Promise.all(destinatarias.map((sub) => enviarPush(admin, sub, payload)));
  } catch {
    // Sin push configurado o sin red: la competencia sigue su curso igual.
  }
}

/**
 * Avisa al entrenador (rol `entrenador`/`admin`). Reusa `push_suscripciones`
 * — está indexada por `alumno_id`, y el entrenador que usa esta app tiene
 * también un `alumno_perfil` propio (cuenta dual), así que su suscripción
 * ya vive ahí si se suscribió alguna vez desde el lado alumno. Si ninguno
 * la tiene todavía, no manda nada — la notificación igual queda en la
 * bandeja (`notificaciones_entrenador`), el push es un extra.
 */
export async function avisarAlEntrenador(payload: PayloadPush): Promise<void> {
  try {
    if (!vapidListo()) return;
    const admin = createAdminClient();

    const { data: entrenadores } = await admin
      .from("perfiles")
      .select("id")
      .in("rol", ["entrenador", "admin"]);
    const idsEntrenadores = (entrenadores ?? []).map((p) => p.id);
    if (idsEntrenadores.length === 0) return;

    const { data: suscripciones } = await admin
      .from("push_suscripciones")
      .select("endpoint, p256dh, auth, alumno_id")
      .in("alumno_id", idsEntrenadores);
    if (!suscripciones || suscripciones.length === 0) return;

    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  } catch {
    // El aviso ya quedó en la bandeja; el push es un extra que no puede
    // tumbar la acción que lo disparó (reportar un bug, mandar una reseña...).
  }
}
