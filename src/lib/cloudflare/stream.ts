import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente mínimo de Cloudflare Stream — solo lo que este proyecto necesita:
 * pedir una URL de subida directa (el archivo nunca pasa por nuestro
 * servidor) y verificar la firma del webhook que avisa cuando el video
 * terminó de procesarse.
 *
 * Variables de entorno requeridas (nunca en código, solo como secretos del
 * entorno — mismo criterio que SUPABASE_SERVICE_ROLE_KEY o ANTHROPIC_API_KEY):
 *
 *   CLOUDFLARE_ACCOUNT_ID           El Account ID de Cloudflare (dashboard,
 *                                   barra lateral derecha de cualquier
 *                                   pantalla del panel).
 *   CLOUDFLARE_STREAM_API_TOKEN     Un API Token (no la Global API Key) con
 *                                   permiso "Stream:Edit" para esa cuenta.
 *                                   Se crea en Perfil → API Tokens → Create
 *                                   Token → plantilla "Custom Token".
 *   CLOUDFLARE_STREAM_CUSTOMER_CODE El subdominio de reproducción de la
 *                                   cuenta (ej. "abc123"), visible en
 *                                   Stream → cualquier video → Embed code,
 *                                   dentro de la URL
 *                                   "customer-<CODE>.cloudflarestream.com".
 *   CLOUDFLARE_STREAM_WEBHOOK_SECRET El secreto que devuelve Cloudflare al
 *                                   registrar el webhook (`PUT
 *                                   /accounts/{id}/stream/webhook`) — hay
 *                                   que guardarlo en ese momento, la API no
 *                                   lo vuelve a mostrar después.
 *
 * Todas las funciones acá degradan con un error claro si falta alguna, en
 * vez de tirar una excepción sin explicación — mismo criterio que
 * `vapidListo()` en push-actions.ts.
 */

function credencialesApi(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !token) return null;
  return { accountId, token };
}

export type SubidaDirecta = { uploadURL: string; uid: string };

/**
 * Pide a Cloudflare una URL de subida directa de un solo uso — el video
 * nunca pasa por nuestro servidor: el navegador del entrenador le manda el
 * archivo directo a esa URL (ver `subirVideoCloudflare` en
 * GaleriaEjercicios.tsx). Cloudflare devuelve el `uid` del video ANTES de
 * que se suba nada, así que se puede vincular al ejercicio de inmediato y
 * mostrar "procesando" hasta que el webhook confirme que está listo.
 *
 * `maxDurationSeconds` limita la duración aceptada — 300s (5 min) alcanza de
 * sobra para un video de referencia de un ejercicio y evita que alguien suba
 * por error un archivo gigante.
 */
export async function solicitarSubidaDirecta(
  maxDurationSeconds = 300
): Promise<{ error: string } | SubidaDirecta> {
  const credenciales = credencialesApi();
  if (!credenciales) {
    return { error: "Cloudflare Stream no está configurado todavía en este entorno." };
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maxDurationSeconds }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch {
    return { error: "No se pudo contactar a Cloudflare Stream. Probá de nuevo." };
  }

  type RespuestaCloudflare = {
    success: boolean;
    result?: { uploadURL: string; uid: string };
    errors?: { message: string }[];
  };
  let cuerpo: RespuestaCloudflare;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return { error: "Cloudflare Stream devolvió una respuesta inesperada." };
  }

  if (!respuesta.ok || !cuerpo.success || !cuerpo.result) {
    const detalle = cuerpo.errors?.[0]?.message;
    return { error: detalle ? `Cloudflare Stream: ${detalle}` : "No se pudo iniciar la subida del video." };
  }

  return { uploadURL: cuerpo.result.uploadURL, uid: cuerpo.result.uid };
}

/**
 * URL del reproductor embebido para un video ya subido. `null` si todavía no
 * se configuró el "customer code" de la cuenta — en ese caso, quien llame
 * debe caer al link externo (`video_url`) en vez de intentar mostrar esto.
 */
export function urlEmbedCloudflare(uid: string): string | null {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!codigo) return null;
  return `https://customer-${codigo}.cloudflarestream.com/${uid}/iframe`;
}

/**
 * Verifica la firma del webhook de Cloudflare Stream (header
 * `Webhook-Signature: time=<segundos>,sig1=<hex>`), calculada como
 * HMAC-SHA256 del secreto sobre `"<time>.<cuerpo crudo>"`.
 *
 * Recibe el secreto como parámetro (en vez de leerlo de `process.env`
 * directamente acá) para poder testear la lógica de verificación con un
 * secreto de prueba, sin depender de una variable de entorno real — ver
 * `stream.test.ts`. `verificarWebhookCloudflare` (más abajo) es el wrapper
 * que sí lee la variable de entorno para el uso real.
 */
export function firmaWebhookValida(
  cuerpoCrudo: string,
  headerFirma: string | null,
  secreto: string
): boolean {
  if (!headerFirma) return false;

  const partes = Object.fromEntries(
    headerFirma.split(",").map((par) => {
      const [clave, valor] = par.split("=");
      return [clave?.trim(), valor?.trim()];
    })
  );
  const time = partes.time;
  const sig1 = partes.sig1;
  if (!time || !sig1) return false;

  const esperada = createHmac("sha256", secreto).update(`${time}.${cuerpoCrudo}`).digest("hex");

  // Longitud distinta ya es "no coincide" — timingSafeEqual tira si los
  // buffers no miden lo mismo, así que ese caso se resuelve antes de llamarla.
  const bufferEsperada = Buffer.from(esperada, "hex");
  const bufferRecibida = Buffer.from(sig1, "hex");
  if (bufferEsperada.length !== bufferRecibida.length) return false;

  return timingSafeEqual(bufferEsperada, bufferRecibida);
}

/** Wrapper que lee `CLOUDFLARE_STREAM_WEBHOOK_SECRET` del entorno — lo que
 * usa de verdad la ruta del webhook. */
export function verificarWebhookCloudflare(cuerpoCrudo: string, headerFirma: string | null): boolean {
  const secreto = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!secreto) return false;
  return firmaWebhookValida(cuerpoCrudo, headerFirma, secreto);
}
