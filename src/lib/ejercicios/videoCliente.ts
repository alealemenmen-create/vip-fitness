/**
 * Helpers de video que corren en el navegador — compartidos entre
 * `GaleriaEjercicios.tsx` (subir/reemplazar el clip de un ejercicio ya
 * creado) y `CargaMasivaFotos.tsx` (carga por lote, instructivo de galería
 * multimedia). Viven acá para no duplicarlos ni crear un import circular
 * entre esos dos componentes.
 */

/** Duración en segundos leída del propio archivo, sin subirlo. `null` si el
 * navegador no puede decodificar el contenedor (pasa con algunos MOV). */
export function duracionVideo(archivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const video = document.createElement("video");
    const terminar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      resolve(valor);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => terminar(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => terminar(null);
    video.src = url;
  });
}

/** Sube el archivo directo a la URL de un solo uso que da Cloudflare Stream,
 * informando progreso — los bytes nunca pasan por Next.js/Vercel. */
export function subirDirectoCloudflare(endpoint: string, archivo: File, onProgreso: (valor: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) onProgreso(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload")));
    xhr.onerror = () => reject(new Error("network"));
    const datos = new FormData();
    datos.append("file", archivo);
    xhr.send(datos);
  });
}

export const TIPOS_VIDEO_ACEPTADOS = "video/mp4,video/quicktime,video/webm";
const EXTENSIONES_VIDEO = new Set(["mp4", "mov", "webm"]);
const EXTENSIONES_IMAGEN = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

/**
 * Detecta si un archivo es imagen o video sin confiar solo en `File.type`:
 * el MOV de iPhone a veces llega con MIME vacío o genérico
 * (`application/octet-stream`) — instructivo §4, "no confiar solamente en
 * File.type". `null` cuando ni el MIME ni la extensión dicen nada útil.
 */
export function tipoDeArchivoMultimedia(archivo: File): "imagen" | "video" | null {
  if (archivo.type.startsWith("image/")) return "imagen";
  if (archivo.type.startsWith("video/")) return "video";
  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  if (EXTENSIONES_VIDEO.has(extension)) return "video";
  if (EXTENSIONES_IMAGEN.has(extension)) return "imagen";
  return null;
}
