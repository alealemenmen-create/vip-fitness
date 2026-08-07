import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente mínimo de Cloudflare Stream — solo lo que este proyecto necesita:
 * pedir una URL de subida reanudable (TUS) que el navegador del entrenador
 * usa para mandar el archivo directo a Cloudflare (nunca pasa por nuestro
 * servidor), generar tokens firmados de reproducción para video privado,
 * eliminar un video, y verificar la firma del webhook que avisa cuando
 * terminó de procesarse (o falló).
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
 * Todas las funciones acá degradan con un error claro (o `null`) si falta
 * alguna, en vez de tirar una excepción sin explicación — mismo criterio que
 * `vapidListo()` en push-actions.ts.
 */

function credencialesApi(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !token) return null;
  return { accountId, token };
}

function aBase64(valor: string): string {
  return Buffer.from(valor, "utf-8").toString("base64");
}

export type SubidaResumable = { endpoint: string; uid: string };

/**
 * Pide a Cloudflare una URL de subida RESUMIBLE (protocolo TUS) y de un solo
 * uso — el video nunca pasa por nuestro servidor: el navegador del
 * entrenador le manda el archivo en partes directo a esa URL con
 * `tus-js-client` (ver `subirArchivo` en GaleriaEjercicios.tsx), pudiendo
 * reanudar si se corta la conexión a mitad de subida. Cloudflare devuelve el
 * `uid` del video ANTES de que se suba nada (viaja en la URL del header
 * `Location`), así que se puede vincular al ejercicio de inmediato y mostrar
 * "subiendo" hasta que el webhook confirme que terminó de procesarse.
 *
 * `requiresignedurls` va SIEMPRE en la metadata: todo video que sube esta
 * app queda privado — solo se puede reproducir con un token firmado de corta
 * duración (ver `urlEmbedFirmada`), nunca con la URL pelada del uid.
 *
 * `tamanoBytes` es obligatorio en el protocolo TUS (header `Upload-Length`)
 * — a diferencia de la subida simple de antes, acá Cloudflare necesita saber
 * el tamaño total ANTES de recibir el primer byte.
 */
export async function solicitarSubidaResumable(
  tamanoBytes: number,
  opciones?: { maxDurationSeconds?: number; nombreArchivo?: string }
): Promise<{ error: string } | SubidaResumable> {
  const credenciales = credencialesApi();
  if (!credenciales) {
    return { error: "Cloudflare Stream no está configurado todavía en este entorno." };
  }

  const maxDurationSeconds = opciones?.maxDurationSeconds ?? 180;
  // Formato de Upload-Metadata del protocolo TUS: pares "clave valor-en-base64"
  // (espacio, no "="), separados por coma. Las claves sin valor (como
  // "requiresignedurls") son flags booleanos.
  const metadata = [`maxDurationSeconds ${aBase64(String(maxDurationSeconds))}`, "requiresignedurls"];
  if (opciones?.nombreArchivo) metadata.push(`name ${aBase64(opciones.nombreArchivo)}`);

  let respuesta: Response;
  try {
    respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credenciales.token}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(tamanoBytes),
          "Upload-Metadata": metadata.join(","),
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch {
    return { error: "No se pudo contactar a Cloudflare Stream. Probá de nuevo." };
  }

  const ubicacion = respuesta.headers.get("Location");
  if (!respuesta.ok || !ubicacion) {
    return { error: "No se pudo iniciar la subida del video." };
  }

  // El `uid` del video es el último segmento de la URL de subida que
  // devuelve Cloudflare — no viaja en ningún cuerpo JSON (la respuesta de
  // creación TUS no tiene cuerpo).
  const uid = ubicacion.split("/").filter(Boolean).pop();
  if (!uid) return { error: "Cloudflare Stream no devolvió un identificador de video válido." };

  return { endpoint: ubicacion, uid };
}

/**
 * Elimina un video de Cloudflare Stream de verdad — se usa al quitar el
 * video de un ejercicio o al reemplazarlo por uno nuevo, para no dejarlo
 * huérfano ahí (ocupando espacio y costando de más indefinidamente).
 *
 * Un 404 (Cloudflare ya no lo tiene — por ejemplo, si la subida nunca llegó
 * a completarse) no se trata como error: el resultado que importa, que el
 * video no exista, ya se cumple.
 */
export async function eliminarVideoCloudflare(uid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const credenciales = credencialesApi();
  if (!credenciales) return { ok: false, error: "Cloudflare Stream no está configurado." };

  try {
    const respuesta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${credenciales.accountId}/stream/${uid}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credenciales.token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!respuesta.ok && respuesta.status !== 404) {
      return { ok: false, error: `Cloudflare Stream devolvió un error al eliminar (${respuesta.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo contactar a Cloudflare Stream para eliminar el video." };
  }
}

/**
 * URL del reproductor embebido para un video privado (`requiresignedurls`,
 * ver `solicitarSubidaResumable`): en vez del uid pelado, lleva un token
 * firmado de corta duración que Cloudflare emite bajo pedido. Solo hay que
 * llamar a esto desde código que ya sabe que el usuario está autenticado
 * (la sesión de un alumno o de un entrenador/admin) — el token es la única
 * llave para reproducir el video, así que no hay que generarlo para nadie
 * más.
 *
 * `null` si Cloudflare no está configurado o si la emisión del token falla
 * (video eliminado, credenciales inválidas, etc.) — quien llama debe caer al
 * link externo (`video_url`) en vez de intentar mostrar esto, igual que
 * cuando el video todavía se está procesando.
 *
 * 4 horas de vigencia: de sobra para ver el video durante un entrenamiento
 * sin que el token expire a mitad de sesión, muy por debajo del máximo de
 * 24h que permite Cloudflare.
 */
export async function urlEmbedFirmada(uid: string, expSegundos = 4 * 60 * 60): Promise<string | null> {
  const codigo = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  const credenciales = credencialesApi();
  if (!codigo || !credenciales) return null;

  let respuesta: Response;
  try {
    respuesta = await fetch(
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
  } catch {
    return null;
  }
  if (!respuesta.ok) return null;

  type RespuestaToken = { success: boolean; result?: { token: string } };
  let cuerpo: RespuestaToken;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return null;
  }
  if (!cuerpo.success || !cuerpo.result?.token) return null;

  return `https://customer-${codigo}.cloudflarestream.com/${cuerpo.result.token}/iframe`;
}

/**
 * Verifica la firma del webhook de Cloudflare Stream (header
 * `Webhook-Signature: time=<segundos>,sig1=<hex>`), calculada como
 * HMAC-SHA256 del secreto sobre `"<time>.<cuerpo crudo>"`.
 *
 * Además de la firma, exige que `time` esté DENTRO de una ventana reciente
 * (±5 minutos de `ahoraMs`) — sin esto, alguien que interceptara un webhook
 * legítimo (o lo obtuviera de logs) podría reenviarlo una y otra vez más
 * adelante: la firma seguiría siendo válida para siempre porque no expira
 * por sí sola, así que la ventana de tiempo es lo que evita ese replay.
 *
 * Recibe el secreto (y `ahoraMs`) como parámetro en vez de leerlos
 * directamente, para poder testear la lógica con valores de prueba fijos sin
 * depender de variables de entorno reales ni del reloj de verdad — ver
 * `stream.test.ts`. `verificarWebhookCloudflare` (más abajo) es el wrapper
 * que sí usa el entorno y el reloj real para el uso en producción.
 */
export function firmaWebhookValida(
  cuerpoCrudo: string,
  headerFirma: string | null,
  secreto: string,
  ahoraMs: number = Date.now()
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

  const timeMs = Number(time) * 1000;
  if (!Number.isFinite(timeMs)) return false;

  const TOLERANCIA_MS = 5 * 60 * 1000;
  if (Math.abs(ahoraMs - timeMs) > TOLERANCIA_MS) return false;

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
