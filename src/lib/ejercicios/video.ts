/** Compartido entre el servidor (`admin/ejercicios/actions.ts`) y el cliente
 * (`ModalVideo.tsx`) para no mantener la misma expresión regular en dos
 * lados. Soporta los formatos comunes de link de YouTube: watch, youtu.be,
 * shorts y embed. */
const REGEX_YOUTUBE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function idDeYoutube(valor: string): string | null {
  return valor.match(REGEX_YOUTUBE)?.[1] ?? null;
}

export type FuenteVideo = { tipo: "iframe"; src: string } | { tipo: "archivo"; src: string };

/**
 * Decide qué reproducir y cómo, con una sola prioridad: el video subido de
 * verdad a Cloudflare Stream (`urlEmbedIframe`, ya resuelto por el servidor
 * con `urlEmbedFirmada` — solo llega no-nulo cuando terminó de procesarse
 * bien) gana sobre el link externo (`videoUrl`, YouTube o archivo directo).
 *
 * Devuelve `null` cuando no hay nada para reproducir todavía — incluye el
 * caso de un video de Cloudflare que se está subiendo/procesando pero
 * todavía no está listo (`urlEmbedIframe` viene null en ese caso, aunque
 * `ejercicio.videoCloudflareUid` ya exista).
 */
export function resolverFuenteVideo(videoUrl: string | null, urlEmbedIframe: string | null): FuenteVideo | null {
  if (urlEmbedIframe) return { tipo: "iframe", src: urlEmbedIframe };
  if (!videoUrl) return null;

  const id = idDeYoutube(videoUrl);
  if (id) return { tipo: "iframe", src: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1` };

  return { tipo: "archivo", src: videoUrl };
}
