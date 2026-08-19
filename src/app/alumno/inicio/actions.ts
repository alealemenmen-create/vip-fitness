"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAlumno } from "@/lib/auth";
import { TAG_RANKING, obtenerMovimientosAlumnoEnRango, type MovimientoResumen } from "@/lib/ranking/data";
import { hoyISO, semanaActualISO } from "@/lib/date";
import { validarSeguimientoDiario } from "@/lib/seguimiento/validar";

export type GuardarSeguimientoState = { error: string | null; guardado: boolean; puntos?: number };

export async function guardarSeguimiento(
  _prevState: GuardarSeguimientoState,
  formData: FormData
): Promise<GuardarSeguimientoState> {
  // `requireAlumno()`, no `auth.getUser()` a secas: con el entrenador en "ver
  // como alumno", el usuario autenticado sigue siendo el entrenador, y esto
  // guardaría el seguimiento en su propia cuenta en vez de la del alumno que
  // está mirando (mismo bug ya arreglado en comer/actions.ts). Esa vista
  // además es de solo lectura.
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) {
    return {
      error: "Estás viendo la cuenta de un alumno en modo lectura. Sal de esa vista para guardar.",
      guardado: false,
    };
  }
  const supabase = await createClient();

  const validacion = validarSeguimientoDiario(formData);
  if (!validacion.ok) return { error: validacion.error, guardado: false };

  const { error } = await supabase.from("seguimientos_diarios").upsert(
    {
      alumno_id: alumnoId,
      fecha: hoyISO(),
      ...validacion.datos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alumno_id,fecha" }
  );

  if (error) {
    return {
      error: "No fue posible guardar tu seguimiento. Revisa tu conexión e intenta nuevamente.",
      guardado: false,
    };
  }

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/inicio");
  revalidatePath("/portal-v2/progreso");
  revalidatePath("/portal-v2/entrenamiento");
  return { error: null, guardado: true };
}

/** Aceptar o rechazar una invitación a un torneo. Usa siempre el ID del
 * alumno de la SESIÓN (no lo que venga en el formulario) para que nadie
 * pueda responder invitaciones ajenas. */
export async function responderInvitacionTorneo(formData: FormData): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;

  const torneoId = String(formData.get("torneo_id") || "");
  const decision = String(formData.get("decision") || "");
  if (!torneoId || (decision !== "aceptado" && decision !== "rechazado")) return;

  const admin = createAdminClient();
  const { data: torneo } = await admin
    .from("torneos")
    .select("cerrado, fecha_inicio")
    .eq("id", torneoId)
    .maybeSingle();
  if (!torneo || torneo.cerrado || hoyISO() >= torneo.fecha_inicio) return;
  await admin
    .from("torneo_participantes")
    .update({ estado: decision })
    .eq("torneo_id", torneoId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente");

  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/ranked");
  revalidatePath("/portal-v2/progreso/comunidad");
  revalidatePath("/admin/torneos");
}

export type DesglosePuntos = { movimientos: MovimientoResumen[]; rango: "dia" | "semana" };

/** Para el Ranking VIP de Inicio: al tocar a un alumno (no necesariamente el
 * de la sesión), trae en qué ganó/perdió puntos hoy — si hoy no tiene
 * movimientos, cae a la semana en curso. Solo requiere una sesión de alumno
 * activa (no que sea el propio alumno): ver la decisión de privacidad en el
 * plan — categoría y puntos son públicos entre compañeros, el detalle de
 * alimentación no (por eso `obtenerMovimientosAlumnoEnRango` no lo trae). */
export async function obtenerDesglosePuntosAlumno(alumnoId: string): Promise<DesglosePuntos> {
  await requireAlumno();
  const hoy = hoyISO();
  const deHoy = await obtenerMovimientosAlumnoEnRango(alumnoId, hoy, hoy);
  if (deHoy.length > 0) return { movimientos: deHoy, rango: "dia" };

  const lunes = semanaActualISO()[0].fecha;
  const deSemana = await obtenerMovimientosAlumnoEnRango(alumnoId, lunes, hoy);
  return { movimientos: deSemana, rango: "semana" };
}
