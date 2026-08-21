import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function credencialesApi(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  return accountId && token ? { accountId, token } : null;
}

type TokenFirmadoCache = { token: string; validoHasta: number };
const tokensFirmados = new Map<string, TokenFirmadoCache>();
const MAX_TOKENS_CACHE = 256;

async function obtenerTokenFirmado(uid: string, expSegundos: number): Promise<string | null> {
  const credenciales = credencialesApi();
  if (!credenciales) return null;
  const ahora = Date.now();
  const existente = tokensFirmados.get(uid);
  if (existente && existente.validoHasta > ahora) return existente.token;

  try {
    const exp = Math.floor(ahora / 1000) + expSegundos;
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/${uid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exp }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    type Respuesta = { success?: boolean; result?: { token?: string } };
    const cuerpo = (await respuesta.json().catch(() => null)) as Respuesta | null;
    const token = cuerpo?.success ? cuerpo.result?.token : null;
    if (!respuesta.ok || !token) return null;

    for (const [clave, valor] of tokensFirmados) {
      if (valor.validoHasta <= ahora) tokensFirmados.delete(clave);
    }
    if (tokensFirmados.size >= MAX_TOKENS_CACHE) {
      const primero = tokensFirmados.keys().next().value as string | undefined;
      if (primero) tokensFirmados.delete(primero);
    }
    // Se deja un minuto de margen para que ningún recurso empiece a cargar con
    // un token a punto de vencer.
    tokensFirmados.set(uid, { token, validoHasta: (exp - 60) * 1000 });
    return token;
  } catch {
    return null;
  }
}

export type SubidaDirecta = { endpoint: string; uid: string };
export type EstadoVideoCloudflare = {
  estado: "procesando" | "listo" | "error";
  duracion: number | null;
  miniaturaUrl: string | null;
  error: string | null;
  ancho: number | null;
  alto: number | null;
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
        input?: { width?: number; height?: number };
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
      ancho: typeof resultado.input?.width === "number" && resultado.input.width > 0 ? resultado.input.width : null,
      alto: typeof resultado.input?.height === "number" && resultado.input.height > 0 ? resultado.input.height : null,
    };
  } catch {
    return null;
  }
}

/**
 * URL privada del reproductor. Dos modos:
 * - "ambiente" (default): sin controles, en silencio, en bucle — el clip
 *   chico que se reproduce solo en el cuadro del ejercicio activo.
 * - "completo": con controles y sonido, sin bucle — el que se abre a
 *   pantalla completa cuando el alumno toca el botón de reproducir. Sin
 *   `letterboxColor` sólido para tapar franjas (eso agranda y recorta un
 *   video vertical hasta perder cabeza y pies, instructivo del 16-ago): acá
 *   se ve el clip completo, con barras negras a los costados si hace falta.
 */
export async function urlEmbedFirmada(
  uid: string,
  opciones: { modo?: "ambiente" | "completo" } = {},
  expSegundos = 4 * 60 * 60
): Promise<string | null> {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!codigo) return null;
  const completo = opciones.modo === "completo";

  try {
    const token = await obtenerTokenFirmado(uid, expSegundos);
    if (!token) return null;
    const parametros = new URLSearchParams({
      autoplay: "true",
      muted: completo ? "false" : "true",
      loop: completo ? "false" : "true",
      controls: completo ? "true" : "false",
      preload: "auto",
      // Fondo negro estable para las franjas necesarias cuando la proporción
      // del clip no coincide con la pantalla. El cliente ya no agranda ni
      // recorta el iframe: preservar cabeza, manos y pies es más importante
      // que llenar cada píxel del cuadro.
      letterboxColor: "000000",
    });
    return `https://customer-${codigo}.cloudflarestream.com/${token}/iframe?${parametros}`;
  } catch {
    return null;
  }
}

/**
 * Miniatura temporal para un video privado de Stream. Los videos que sube el
 * portal exigen URL firmada, por lo que el UID guardado por el webhook no se
 * puede usar directamente en `/thumbnails/thumbnail.jpg`: Cloudflare responde
 * 401. El mismo token corto del reproductor sirve para sus recursos derivados.
 */
export async function urlMiniaturaFirmada(
  uid: string,
  expSegundos = 4 * 60 * 60
): Promise<string | null> {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!codigo) return null;
  const token = await obtenerTokenFirmado(uid, expSegundos);
  return token
    ? `https://customer-${codigo}.cloudflarestream.com/${token}/thumbnails/thumbnail.jpg`
    : null;
}

/**
 * Portada que coincide con el inicio real del clip. Se usa en la vista
 * inmersiva para que la imagen inicial y el primer fotograma compartan
 * encuadre y el paso a reproducción no produzca un salto visual.
 */
export async function urlPosterVideoFirmado(
  uid: string,
  expSegundos = 4 * 60 * 60
): Promise<string | null> {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!codigo) return null;
  const token = await obtenerTokenFirmado(uid, expSegundos);
  return token
    ? `https://customer-${codigo}.cloudflarestream.com/${token}/thumbnails/thumbnail.jpg?time=0s&height=1080`
    : null;
}

export function firmaWebhookValida(
  cuerpoCrudo: string,
  headerFirma: string | null,
  secreto: string,
  ahoraMs = Date.now()
): boolean {
  const timeMs = tiempoFirmaWebhookCloudflare(headerFirma);
  if (timeMs === null || Math.abs(ahoraMs - timeMs) > 5 * 60 * 1000) return false;
  if (!headerFirma) return false;
  const partes = Object.fromEntries(
    headerFirma.split(",").map((par) => {
      const [clave, valor] = par.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );
  if (!partes.time || !partes.sig1 || !/^[a-f\d]{64}$/i.test(partes.sig1)) return false;

  const esperada = createHmac("sha256", secreto)
    .update(`${partes.time}.${cuerpoCrudo}`)
    .digest("hex");
  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(partes.sig1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Instante firmado por Cloudflare, en milisegundos. El handler lo persiste
 * para que un reenvío antiguo no pueda pisar un estado más nuevo. */
export function tiempoFirmaWebhookCloudflare(headerFirma: string | null): number | null {
  if (!headerFirma) return null;
  const parteTiempo = headerFirma
    .split(",")
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith("time="));
  const valor = parteTiempo?.slice("time=".length);
  if (!valor || !/^\d{10,13}$/.test(valor)) return null;
  const segundos = Number(valor);
  return Number.isFinite(segundos) ? segundos * 1000 : null;
}

export function verificarWebhookCloudflare(cuerpoCrudo: string, headerFirma: string | null): boolean {
  const secreto = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  return !!secreto && firmaWebhookValida(cuerpoCrudo, headerFirma, secreto);
}
