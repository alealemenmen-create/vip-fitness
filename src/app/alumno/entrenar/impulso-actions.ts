"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import type { MomentoAlertaImpulso } from "@/lib/supabase/types";

export type ReportarDolorState = { error: string | null; ok: boolean };

const MOMENTOS_VALIDOS = new Set(["antes", "durante", "despues"]);

/**
 * Reporte explícito de dolor/molestia en un ejercicio — acción separada del
 * guardado normal de series (`guardarSeries` en `actions.ts`): reportar
 * dolor es una decisión aparte, no un dato más de la serie.
 *
 * Solo una alerta de tipo 'dolor' por `sesion_ejercicio_id` (índice único en
 * la migración 0043): si el alumno ya la había reportado para este mismo
 * ejercicio de esta sesión, un segundo envío no duplica ni falla — se trata
 * como ya registrado.
 */
export async function reportarDolor(
  _prevState: ReportarDolorState,
  formData: FormData
): Promise<ReportarDolorState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: null, ok: false };

  const sesionEjercicioId = String(formData.get("sesion_ejercicio_id") || "");
  const diaEjercicioId = String(formData.get("dia_ejercicio_id") || "");
  const sesionId = String(formData.get("sesion_id") || "");
  if (!sesionEjercicioId || !diaEjercicioId) return { error: "Falta información del ejercicio.", ok: false };

  const zona = String(formData.get("zona") || "").trim();
  const intensidadRaw = formData.get("intensidad");
  const intensidad = intensidadRaw ? Number(intensidadRaw) : null;
  if (intensidad !== null && (!Number.isInteger(intensidad) || intensidad < 1 || intensidad > 5)) {
    return { error: "La intensidad debe ser un número entre 1 y 5.", ok: false };
  }
  const momentoRaw = String(formData.get("momento") || "");
  const momento: MomentoAlertaImpulso | null = MOMENTOS_VALIDOS.has(momentoRaw)
    ? (momentoRaw as MomentoAlertaImpulso)
    : null;
  const detuvoEjercicio = formData.get("detuvo_ejercicio") === "true";
  const detalle = String(formData.get("detalle") || "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("impulso_vip_alertas").insert({
    alumno_id: alumnoId,
    dia_ejercicio_id: diaEjercicioId,
    sesion_ejercicio_id: sesionEjercicioId,
    tipo: "dolor",
    zona: zona || null,
    intensidad,
    momento,
    detuvo_ejercicio: detuvoEjercicio,
    detalle: detalle || null,
  });

  if (error) {
    // 23505: ya existía una alerta de dolor para este mismo ejercicio de
    // esta sesión (índice único sesion_ejercicio_id+tipo) — no es un error
    // real para el alumno, ya quedó registrado.
    if (error.code === "23505") return { error: null, ok: true };
    return { error: "No fue posible registrar la molestia. Intentá de nuevo.", ok: false };
  }

  if (sesionId) revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  return { error: null, ok: true };
}
