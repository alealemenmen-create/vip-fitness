import "server-only";
import sharp from "sharp";

export const TAMANO_MAXIMO_FOTO = 15 * 1024 * 1024; // 15 MB, la foto sin procesar del celular.
export const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/**
 * Convierte bytes de Node en un cuerpo Web binario explícito.
 *
 * Enviar un `Buffer` directamente deja que cada implementación/interceptor
 * de `fetch` decida cómo serializarlo. Un `Blob`, en cambio, obliga al SDK de
 * Storage a usar `multipart/form-data` y evita cualquier coerción a texto
 * UTF-8 (la causa del patrón EF BF BD observado en producción).
 */
export function bufferAImagenBlob(bytes: Buffer, contentType = "image/webp"): Blob {
  const copia = Uint8Array.from(bytes);
  return new Blob([copia.buffer], { type: contentType });
}

/**
 * Redimensiona una foto a las dos versiones que usa toda la app — miniatura
 * cuadrada (500x500, recortada, para la tarjetita) y completa (1400px de
 * ancho, sin recortar, para el visor ampliado) — a partir de la MISMA foto,
 * nunca dos fotos distintas. `.rotate()` sin argumentos aplica la
 * orientación EXIF del celular, así la foto queda derecha sin depender de
 * que el navegador la interprete.
 *
 * Vive en un módulo aparte (sin `"use server"`) para que el respaldo por URL
 * de `actions.ts` pueda procesar una imagen descargada por el servidor.
 */
export async function procesarImagen(
  bytes: Buffer
): Promise<{ miniatura: Buffer; completa: Buffer } | { error: string }> {
  try {
    const base = sharp(bytes).rotate();
    const [miniatura, completa] = await Promise.all([
      base.clone().resize({ width: 500, height: 500, fit: "cover" }).webp({ quality: 80 }).toBuffer(),
      base.clone().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    ]);
    return { miniatura, completa };
  } catch {
    return { error: "No se pudo procesar esa foto — probá con otra." };
  }
}
