"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";

export type ResolverReporteState = { error: string | null; ok: boolean };

/** Marca un reporte de falla como resuelto (o lo reabre). El historial no se
 * borra: sirve para ver si un mismo problema vuelve a aparecer. */
export async function cambiarEstadoReporteBug(
  _prevState: ResolverReporteState,
  formData: FormData
): Promise<ResolverReporteState> {
  const sesion = await requireRol(["entrenador", "admin"]);

  const id = String(formData.get("id") || "");
  const nuevoEstado = String(formData.get("estado") || "");
  if (!id || (nuevoEstado !== "pendiente" && nuevoEstado !== "resuelto")) {
    return { error: "Falta el reporte.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reportes_bugs")
    .update({
      estado: nuevoEstado,
      resuelto_en: nuevoEstado === "resuelto" ? new Date().toISOString() : null,
      resuelto_por: nuevoEstado === "resuelto" ? sesion.userId : null,
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el reporte.", ok: false };

  revalidatePath("/admin/reportes");
  return { error: null, ok: true };
}
