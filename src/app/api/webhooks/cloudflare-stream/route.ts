import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarWebhookCloudflare } from "@/lib/cloudflare/stream";
import { TAG_BIBLIOTECA_EJERCICIOS } from "@/lib/ejercicios/data";

export const dynamic = "force-dynamic";

/**
 * Webhook de Cloudflare Stream: avisa cuando un video terminó de procesarse
 * (o falló). Es la única forma de saber que un video ya está listo para
 * reproducirse — la subida resumible desde el navegador (ver
 * `solicitarSubidaResumable`) no lo sabe, Cloudflare lo procesa en segundo
 * plano después.
 *
 * No requiere sesión (lo llama Cloudflare, no un usuario logueado) — la
 * autenticación es la firma HMAC del header `Webhook-Signature`, verificada
 * contra `CLOUDFLARE_STREAM_WEBHOOK_SECRET`. Hay que leer el cuerpo como
 * texto CRUDO antes de parsearlo: la firma se calcula sobre los bytes
 * exactos que mandó Cloudflare, no sobre una reserialización del JSON (que
 * podría no ser byte-a-byte idéntica).
 *
 * Registrar este webhook en la cuenta de Cloudflare (una sola vez, desde
 * fuera de la app):
 *   curl -X PUT \
 *     "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/stream/webhook" \
 *     -H "Authorization: Bearer <API_TOKEN>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"notificationUrl": "https://<dominio-de-produccion>/api/webhooks/cloudflare-stream"}'
 * La respuesta incluye el secreto UNA sola vez — hay que guardarlo ahí mismo
 * como CLOUDFLARE_STREAM_WEBHOOK_SECRET, la API no lo vuelve a mostrar.
 */
export async function POST(request: Request): Promise<Response> {
  const cuerpoCrudo = await request.text();
  const firma = request.headers.get("Webhook-Signature");

  if (!process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: "CLOUDFLARE_STREAM_WEBHOOK_SECRET no configurado." }, { status: 503 });
  }
  if (!verificarWebhookCloudflare(cuerpoCrudo, firma)) {
    return Response.json({ ok: false, error: "Firma inválida." }, { status: 401 });
  }

  type PayloadCloudflare = {
    uid?: string;
    readyToStream?: boolean;
    status?: { state?: string; errorReasonCode?: string; errorReasonText?: string };
    duration?: number;
    thumbnail?: string;
  };
  let payload: PayloadCloudflare;
  try {
    payload = JSON.parse(cuerpoCrudo);
  } catch {
    return Response.json({ ok: false, error: "Cuerpo no es JSON válido." }, { status: 400 });
  }

  const uid = payload.uid;
  if (!uid) return Response.json({ ok: false, error: "Falta el uid del video." }, { status: 400 });

  const estadoCloudflare = payload.status?.state;
  const estado: "listo" | "error" | "procesando" =
    payload.readyToStream === true || estadoCloudflare === "ready"
      ? "listo"
      : estadoCloudflare === "error"
        ? "error"
        : "procesando";

  // -1 es el valor que manda Cloudflare mientras todavía no conoce la
  // duración real (recién arrancó a procesar) — no hay que guardarlo como si
  // fuera un dato válido.
  const duracion = typeof payload.duration === "number" && payload.duration >= 0 ? payload.duration : null;
  const miniatura = payload.thumbnail ?? null;
  const mensajeError =
    estado === "error" ? payload.status?.errorReasonText || payload.status?.errorReasonCode || "Error desconocido de Cloudflare." : null;

  const admin = createAdminClient();
  const { data: actualizados, error } = await admin
    .from("ejercicios")
    .update({
      video_cloudflare_estado: estado,
      video_cloudflare_duracion_seg: duracion,
      video_cloudflare_miniatura_url: miniatura,
      video_cloudflare_error: mensajeError,
    })
    .eq("video_cloudflare_uid", uid)
    .select("id");

  if (error) {
    return Response.json({ ok: false, error: "No se pudo actualizar el ejercicio." }, { status: 500 });
  }

  // Ningún ejercicio referenciaba ese uid (ej. se eliminó el ejercicio
  // mientras el video procesaba) — no es un error del webhook en sí, se
  // responde 200 igual para que Cloudflare no lo siga reintentando.
  if (actualizados && actualizados.length > 0) {
    revalidateTag(TAG_BIBLIOTECA_EJERCICIOS, { expire: 0 });
    revalidatePath("/admin/ejercicios");
    revalidatePath("/alumno/entrenar");
    revalidatePath("/alumno/entrenar/[id]", "page");
  }

  return Response.json({ ok: true });
}
