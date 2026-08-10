"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import type { PeriodoSeguimiento } from "@/lib/seguimiento/tipos";

export type RevisionState = { ok: boolean; error: string | null };

export async function guardarRevisionSeguimiento(
  _prevState: RevisionState,
  formData: FormData
): Promise<RevisionState> {
  void _prevState;
  const sesion = await requireRol(["entrenador", "admin"]);
  const alumnoId = String(formData.get("alumno_id") || "");
  const periodoNumero = Number(formData.get("periodo"));
  const periodo = ([7, 14, 30] as number[]).includes(periodoNumero) ? periodoNumero as PeriodoSeguimiento : null;
  const observacion = String(formData.get("observacion") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  if (!alumnoId || !periodo) return { ok: false, error: "Faltan datos del período." };
  if (observacion.length < 3) return { ok: false, error: "Escribe una observación para el alumno." };
  if (observacion.length > 2000 || decision.length > 1000) return { ok: false, error: "La observación es demasiado larga." };

  const supabase = await createClient();
  const seguimiento = await obtenerSeguimientoIntegral(supabase, alumnoId, periodo);
  if (!seguimiento) return { ok: false, error: "No se encontró el alumno." };
  const { error } = await supabase.from("seguimiento_revisiones").insert({
    alumno_id: alumnoId,
    entrenador_id: sesion.userId,
    desde: seguimiento.desde,
    hasta: seguimiento.hasta,
    dias_periodo: periodo,
    adherencia_general: seguimiento.resumen.adherenciaGeneral,
    resumen: seguimiento.resumen,
    observacion,
    decision_siguiente_plan: decision || null,
  });
  if (error) return { ok: false, error: "No fue posible guardar la revisión. Verifica que la migración de seguimiento esté aplicada." };

  revalidatePath(`/admin/alumnos/${alumnoId}/seguimiento`);
  revalidatePath("/alumno/progreso");
  return { ok: true, error: null };
}
