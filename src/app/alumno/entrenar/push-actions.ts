"use server";

import { after } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "soporte@vipfitness.cl"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

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
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

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
      body: "Volvé a la app para tu siguiente serie.",
      tag: "fin-descanso",
      url: "/alumno/entrenar",
    };
    await Promise.all(suscripciones.map((sub) => enviarPush(admin, sub, payload)));
  });
}
