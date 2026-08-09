import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function credencialesApi(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  return accountId && token ? { accountId, token } : null;
}

export type SubidaDirecta = { endpoint: string; uid: string };
export type EstadoVideoCloudflare = {
  estado: "procesando" | "listo" | "error";
  duracion: number | null;
  miniaturaUrl: string | null;
  error: string | null;
};

/**
 * Crea una URL de subida de un solo uso. Los bytes viajan directamente del
 * navegador del entrenador a Cloudflare y nunca pasan por Next.js/Vercel.
 * Para los clips de esta función (máx. 30 s y 100 MB) Cloudflare recomienda
 * la subida POST directa; TUS queda reservado para archivos grandes o redes
 * especialmente inestables.
 */
export async function solicitarSubidaDirecta(opciones: {
  maxDurationSeconds?: number;
  creator?: string;
}): Promise<{ error: string } | SubidaDirecta> {
  const credenciales = credencialesApi();
  if (!credenciales) return { error: "Cloudflare Stream no está configurado todavía." };

  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: opciones.maxDurationSeconds ?? 30,
          requireSignedURLs: true,
          creator: opciones.creator,
          thumbnailTimestampPct: 0.15,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    type Respuesta = {
      success?: boolean;
      result?: { uploadURL?: string; uid?: string };
    };
    const cuerpo = (await respuesta.json().catch(() => null)) as Respuesta | null;
    if (!respuesta.ok || !cuerpo?.success || !cuerpo.result?.uploadURL || !cuerpo.result.uid) {
      return { error: "No se pudo iniciar la subida del video en Cloudflare." };
    }
    return { endpoint: cuerpo.result.uploadURL, uid: cuerpo.result.uid };
  } catch {
    return { error: "No se pudo contactar a Cloudflare Stream. Intenta nuevamente." };
  }
}

export async function eliminarVideoCloudflare(uid: string): Promise<boolean> {
  const credenciales = credencialesApi();
  if (!credenciales) return false;
  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/${uid}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credenciales.token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    return respuesta.ok || respuesta.status === 404;
  } catch {
    return false;
  }
}

/** Consulta el estado real para no depender exclusivamente del webhook. */
export async function consultarVideoCloudflare(uid: string): Promise<EstadoVideoCloudflare | null> {
  const credenciales = credencialesApi();
  if (!credenciales) return null;
  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/${uid}`,
      {
        headers: { Authorization: `Bearer ${credenciales.token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    type Respuesta = {
      success?: boolean;
      result?: {
        readyToStream?: boolean;
        duration?: number;
        thumbnail?: string;
        status?: { state?: string; errorReasonText?: string };
      };
    };
    const cuerpo = (await respuesta.json().catch(() => null)) as Respuesta | null;
    if (!respuesta.ok || !cuerpo?.success || !cuerpo.result) return null;
    const resultado = cuerpo.result;
    const esError = resultado.status?.state === "error";
    return {
      estado: resultado.readyToStream || resultado.status?.state === "ready"
        ? "listo"
        : esError ? "error" : "procesando",
      duracion: typeof resultado.duration === "number" && resultado.duration >= 0
        ? resultado.duration : null,
      miniaturaUrl: resultado.thumbnail ?? null,
      error: esError ? resultado.status?.errorReasonText ?? "Cloudflare no pudo procesar el video." : null,
    };
  } catch {
    return null;
  }
}

/** URL privada del reproductor sin controles, en silencio y en bucle. */
export async function urlEmbedFirmada(uid: string, expSegundos = 4 * 60 * 60): Promise<string | null> {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  const credenciales = credencialesApi();
  if (!codigo || !credenciales) return null;

  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/${uid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSegundos }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    type Respuesta = { success?: boolean; result?: { token?: string } };
    const cuerpo = (await respuesta.json().catch(() => null)) as Respuesta | null;
    const token = cuerpo?.success ? cuerpo.result?.token : null;
    if (!respuesta.ok || !token) return null;
    const parametros = new URLSearchParams({
      autoplay: "true",
      muted: "true",
      loop: "true",
      controls: "false",
      preload: "auto",
      letterboxColor: "transparent",
    });
    return `https://customer-${codigo}.cloudflarestream.com/${token}/iframe?${parametros}`;
  } catch {
    return null;
  }
}

export function firmaWebhookValida(
  cuerpoCrudo: string,
  headerFirma: string | null,
  secreto: string,
  ahoraMs = Date.now()
): boolean {
  if (!headerFirma) return false;
  const partes = Object.fromEntries(
    headerFirma.split(",").map((par) => {
      const [clave, valor] = par.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );
  if (!partes.time || !partes.sig1) return false;
  const timeMs = Number(partes.time) * 1000;
  if (!Number.isFinite(timeMs) || Math.abs(ahoraMs - timeMs) > 5 * 60 * 1000) return false;

  const esperada = createHmac("sha256", secreto)
    .update(`${partes.time}.${cuerpoCrudo}`)
    .digest("hex");
  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(partes.sig1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verificarWebhookCloudflare(cuerpoCrudo: string, headerFirma: string | null): boolean {
  const secreto = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  return !!secreto && firmaWebhookValida(cuerpoCrudo, headerFirma, secreto);
}
