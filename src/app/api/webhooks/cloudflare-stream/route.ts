import { revalidatePath } from "next/cache";
import { tiempoFirmaWebhookCloudflare, verificarWebhookCloudflare } from "@/lib/cloudflare/stream";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
const MAX_CUERPO_BYTES = 64 * 1024;

function miniaturaCloudflareValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || valor.length > 2048) return false;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && (
      url.hostname === "cloudflarestream.com" ||
      url.hostname.endsWith(".cloudflarestream.com") ||
      url.hostname === "videodelivery.net" ||
      url.hostname.endsWith(".videodelivery.net")
    );
  } catch {
    return false;
  }
}

function numeroPositivo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

function textoCorto(valor: unknown, maximo = 500): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, maximo) : null;
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: "Webhook no configurado." }, { status: 503 });
  }
  const largoDeclarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(largoDeclarado) && largoDeclarado > MAX_CUERPO_BYTES) {
    return Response.json({ ok: false, error: "Cuerpo demasiado grande." }, { status: 413 });
  }

  let cuerpoCrudo: string;
  try {
    cuerpoCrudo = await request.text();
  } catch {
    return Response.json({ ok: false, error: "No se pudo leer el cuerpo." }, { status: 400 });
  }
  if (Buffer.byteLength(cuerpoCrudo, "utf8") > MAX_CUERPO_BYTES) {
    return Response.json({ ok: false, error: "Cuerpo demasiado grande." }, { status: 413 });
  }

  const headerFirma = request.headers.get("Webhook-Signature");
  if (!verificarWebhookCloudflare(cuerpoCrudo, headerFirma)) {
    return Response.json({ ok: false, error: "Firma inválida." }, { status: 401 });
  }
  const webhookMs = tiempoFirmaWebhookCloudflare(headerFirma);
  if (webhookMs === null) return Response.json({ ok: false, error: "Firma inválida." }, { status: 401 });

  type Payload = {
    uid?: string;
    readyToStream?: boolean;
    status?: { state?: string; errorReasonCode?: string; errorReasonText?: string };
    duration?: number;
    thumbnail?: string;
    input?: { width?: number; height?: number };
  };
  let payload: Payload;
  try {
    payload = JSON.parse(cuerpoCrudo) as Payload;
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (typeof payload.uid !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(payload.uid)) {
    return Response.json({ ok: false, error: "UID inválido." }, { status: 400 });
  }

  const estadoCloudflare = payload.status?.state;
  const estado: "listo" | "error" | "procesando" =
    payload.readyToStream === true || estadoCloudflare === "ready"
      ? "listo"
      : estadoCloudflare === "error"
        ? "error"
        : "procesando";
  const duracion = numeroPositivo(payload.duration);
  const mensajeError =
    estado === "error"
      ? textoCorto(payload.status?.errorReasonText) || textoCorto(payload.status?.errorReasonCode) || "Cloudflare no pudo procesar el video."
      : null;

  const actualizacion: Database["public"]["Tables"]["ejercicios"]["Update"] = {
    video_cloudflare_estado: estado,
    video_cloudflare_webhook_en: new Date(webhookMs).toISOString(),
  };
  if (duracion !== null) actualizacion.video_cloudflare_duracion_seg = duracion;
  if (miniaturaCloudflareValida(payload.thumbnail)) {
    actualizacion.video_cloudflare_miniatura_url = payload.thumbnail;
  }
  const ancho = numeroPositivo(payload.input?.width);
  const alto = numeroPositivo(payload.input?.height);
  if (ancho !== null) actualizacion.video_cloudflare_ancho = Math.round(ancho);
  if (alto !== null) actualizacion.video_cloudflare_alto = Math.round(alto);
  if (estado === "error") actualizacion.video_cloudflare_error = mensajeError;
  if (estado === "listo") actualizacion.video_cloudflare_error = null;

  try {
    let consulta = createAdminClient()
      .from("ejercicios")
      .update(actualizacion)
      .eq("video_cloudflare_uid", payload.uid)
      // La fecha proviene de una firma HMAC ya validada. Evita que Cloudflare
      // reenvíe después un evento anterior y borre un estado más nuevo.
      .or(`video_cloudflare_webhook_en.is.null,video_cloudflare_webhook_en.lte.${new Date(webhookMs).toISOString()}`);
    if (estado === "procesando") {
      // "listo" y "error" son terminales. Un evento tardío de procesamiento
      // jamás puede devolverlos hacia atrás.
      consulta = consulta.or("video_cloudflare_estado.is.null,video_cloudflare_estado.not.in.(listo,error)");
    }
    const { data, error } = await consulta.select("id");
    if (error) return Response.json({ ok: false, error: "No se pudo actualizar el video." }, { status: 500 });
    if (data?.length) {
      revalidatePath("/admin/ejercicios");
      revalidatePath("/alumno/entrenar");
    }
    return Response.json({ ok: true, actualizado: Boolean(data?.length) });
  } catch {
    return Response.json({ ok: false, error: "No se pudo actualizar el video." }, { status: 500 });
  }
}

