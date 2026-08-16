import "server-only";
import sharp from "sharp";
import { createHash } from "crypto";

export const TAMANO_MAXIMO_FOTO = 15 * 1024 * 1024; // 15 MB, la foto sin procesar del celular.
export const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Instructivo 8.5, "resolución insuficiente": por debajo de esto la foto se
// ve pixelada hasta en la miniatura chica — casi siempre es un screenshot,
// un ícono o un recorte por error, no una foto real de gimnasio (que en
// celular sale con miles de píxeles de lado incluso comprimida).
const LADO_MINIMO_FOTO = 350;

/** Hash del contenido de una imagen ya procesada — sirve para detectar
 * duplicados exactos por contenido (ver ejercicio_foto_hash, migración
 * 0095) sin importar en qué archivo/URL de Storage haya terminado cada uno. */
export function hashearImagen(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

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
    const metadatos = await base.clone().metadata();
    const lado = Math.min(metadatos.width ?? 0, metadatos.height ?? 0);
    if (lado > 0 && lado < LADO_MINIMO_FOTO) {
      return { error: `La foto es muy chica (mínimo ${LADO_MINIMO_FOTO}px de lado) — probá con una de mejor calidad.` };
    }
    const [miniatura, completa] = await Promise.all([
      base.clone().resize({ width: 500, height: 500, fit: "cover" }).webp({ quality: 80 }).toBuffer(),
      base.clone().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    ]);
    return { miniatura, completa };
  } catch {
    return { error: "No se pudo procesar esa foto — probá con otra." };
  }
}
