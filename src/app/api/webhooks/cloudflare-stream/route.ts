import { revalidatePath } from "next/cache";
import { verificarWebhookCloudflare } from "@/lib/cloudflare/stream";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpoCrudo = await request.text();
  if (!process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: "Webhook no configurado." }, { status: 503 });
  }
  if (!verificarWebhookCloudflare(cuerpoCrudo, request.headers.get("Webhook-Signature"))) {
    return Response.json({ ok: false, error: "Firma inválida." }, { status: 401 });
  }

  type Payload = {
    uid?: string;
    readyToStream?: boolean;
    status?: { state?: string; errorReasonCode?: string; errorReasonText?: string };
    duration?: number;
    thumbnail?: string;
  };
  let payload: Payload;
  try {
    payload = JSON.parse(cuerpoCrudo) as Payload;
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!payload.uid) return Response.json({ ok: false, error: "Falta uid." }, { status: 400 });

  const estadoCloudflare = payload.status?.state;
  const estado: "listo" | "error" | "procesando" =
    payload.readyToStream || estadoCloudflare === "ready"
      ? "listo"
      : estadoCloudflare === "error"
        ? "error"
        : "procesando";
  const duracion = typeof payload.duration === "number" && payload.duration >= 0 ? payload.duration : null;
  const mensajeError =
    estado === "error"
      ? payload.status?.errorReasonText || payload.status?.errorReasonCode || "Cloudflare no pudo procesar el video."
      : null;

  const { data, error } = await createAdminClient()
    .from("ejercicios")
    .update({
      video_cloudflare_estado: estado,
      video_cloudflare_duracion_seg: duracion,
      video_cloudflare_miniatura_url: payload.thumbnail ?? null,
      video_cloudflare_error: mensajeError,
    })
    .eq("video_cloudflare_uid", payload.uid)
    .select("id");
  if (error) return Response.json({ ok: false }, { status: 500 });
  if (data?.length) {
    revalidatePath("/admin/ejercicios");
    revalidatePath("/alumno/entrenar");
  }
  return Response.json({ ok: true });
}

