// Solo se usa desde componentes cliente (requiere Canvas del navegador).
export async function comprimirImagen(
  archivo: File,
  maxLado = 1600,
  calidad = 0.8
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", calidad)
    );
    if (!blob) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    // Formato no soportado por el navegador (ej. algunos HEIC) — se sube el
    // original en vez de bloquear la subida.
    return archivo;
  }
}
