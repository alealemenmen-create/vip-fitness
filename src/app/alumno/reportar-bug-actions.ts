"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { crearNotificacionEntrenador } from "@/lib/notificaciones/crear";

export type ReportarBugState = { error: string | null; ok: boolean };

/** La captura llega como data URL desde el navegador (html2canvas). Se acota
 * el tamaño para que un teléfono con pantalla grande no mande 8 MB de PNG por
 * un reporte: 4 MB de base64 son ~3 MB de imagen, de sobra para una captura. */
const MAXIMO_CAPTURA_BASE64 = 4 * 1024 * 1024;

/**
 * Reporte de falla del alumno: descripción + captura del momento.
 *
 * La captura es OPCIONAL a propósito. `html2canvas` falla en algunas
 * combinaciones (imágenes de otro dominio sin CORS, un canvas de video),
 * y en ese caso vale mucho más un reporte sin imagen que ningún reporte:
 * la descripción y la ruta ya le dicen al entrenador dónde mirar.
 */
export async function reportarBug(
  _prevState: ReportarBugState,
  formData: FormData
): Promise<ReportarBugState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) {
    return { error: "Estás viendo la cuenta de un alumno en modo lectura.", ok: false };
  }

  const descripcion = String(formData.get("descripcion") || "").trim();
  const ruta = String(formData.get("ruta") || "").trim().slice(0, 300);
  const dispositivo = String(formData.get("dispositivo") || "").trim().slice(0, 400) || null;
  const capturaDataUrl = String(formData.get("captura") || "");

  if (descripcion.length < 5) {
    return { error: "Cuéntanos brevemente qué pasó (mínimo 5 caracteres).", ok: false };
  }

  const supabase = await createClient();

  let capturaPath: string | null = null;
  // El prefijo se valida en vez de confiar en el cliente: lo que llega es una
  // cadena arbitraria del navegador y termina siendo bytes en Storage.
  if (capturaDataUrl.startsWith("data:image/png;base64,") && capturaDataUrl.length <= MAXIMO_CAPTURA_BASE64) {
    const base64 = capturaDataUrl.slice("data:image/png;base64,".length);
    try {
      const bytes = Buffer.from(base64, "base64");
      const destino = `${alumnoId}/${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("reportes-bugs")
        .upload(destino, bytes, { contentType: "image/png" });
      if (!error) capturaPath = destino;
    } catch {
      // Igual que arriba: la captura es un extra, no un requisito.
    }
  }

  const { error } = await supabase.from("reportes_bugs").insert({
    alumno_id: alumnoId,
    ruta: ruta || "/",
    descripcion: descripcion.slice(0, 2000),
    captura_path: capturaPath,
    dispositivo,
  });

  if (error) {
    return { error: "No pudimos enviar tu reporte. Revisa tu conexión e intenta nuevamente.", ok: false };
  }

  await crearNotificacionEntrenador({
    tipo: "bug",
    alumnoId,
    titulo: "Nueva falla reportada",
    cuerpo: descripcion.slice(0, 140),
    prioridad: "alta",
    ruta: "/admin/reportes",
  });

  revalidatePath("/admin/reportes");
  return { error: null, ok: true };
}
