"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";

export type ReportarFotoState = { error: string | null; ok: boolean };

export async function reportarFotoIncorrecta(
  _prevState: ReportarFotoState,
  formData: FormData
): Promise<ReportarFotoState> {
  const sesionEjercicioId = String(formData.get("sesion_ejercicio_id") || "");
  const diaEjercicioId = String(formData.get("dia_ejercicio_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if ((!sesionEjercicioId && !diaEjercicioId) || soloLectura) {
    return { error: "No se pudo enviar el reporte.", ok: false };
  }

  const supabase = await createClient();
  let programaId = diaEjercicioId;

  if (sesionEjercicioId) {
    const { data: sesionEjercicio } = await supabase
      .from("sesion_ejercicios")
      .select("sesion_id, dia_ejercicio_id")
      .eq("id", sesionEjercicioId)
      .maybeSingle();
    if (!sesionEjercicio) return { error: "No encontramos este ejercicio.", ok: false };

    const { data: sesion } = await supabase
      .from("sesiones_entrenamiento")
      .select("id")
      .eq("id", sesionEjercicio.sesion_id)
      .eq("alumno_id", alumnoId)
      .maybeSingle();
    if (!sesion) return { error: "No puedes reportar este ejercicio.", ok: false };
    programaId = sesionEjercicio.dia_ejercicio_id;
  }

  const { data: programa } = await supabase
    .from("rutina_dia_ejercicios")
    .select("nombre, ejercicio_id, dia_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa) return { error: "No encontramos la referencia de este ejercicio.", ok: false };

  // En la portada todavía no existe una sesión. Validamos igualmente que el
  // ejercicio pertenezca a la rutina activa del alumno antes de aceptar el
  // aviso; mirar una rutina nunca debe crear una sesión solo para reportar.
  if (!sesionEjercicioId) {
    const { data: dia } = await supabase
      .from("rutina_dias")
      .select("rutina_id")
      .eq("id", programa.dia_id)
      .maybeSingle();
    const { data: rutina } = dia
      ? await supabase
          .from("rutinas")
          .select("id")
          .eq("id", dia.rutina_id)
          .eq("alumno_id", alumnoId)
          .eq("activa", true)
          .maybeSingle()
      : { data: null };
    if (!rutina) return { error: "No puedes reportar este ejercicio.", ok: false };
  }

  const { data: biblioteca } = programa.ejercicio_id
    ? await supabase
        .from("ejercicios")
        .select("foto_completa_url, foto_miniatura_url")
        .eq("id", programa.ejercicio_id)
        .maybeSingle()
    : { data: null };
  const fotoUrl = biblioteca?.foto_completa_url ?? biblioteca?.foto_miniatura_url ?? null;

  const consultaExistente = supabase
    .from("reportes_fotos_ejercicios")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente");
  const { data: existente } = programa.ejercicio_id
    ? await consultaExistente.eq("ejercicio_id", programa.ejercicio_id).maybeSingle()
    : sesionEjercicioId
      ? await consultaExistente.eq("sesion_ejercicio_id", sesionEjercicioId).maybeSingle()
      : { data: null };
  if (existente) return { error: null, ok: true };

  const { error } = await supabase.from("reportes_fotos_ejercicios").insert({
    alumno_id: alumnoId,
    ejercicio_id: programa.ejercicio_id,
    sesion_ejercicio_id: sesionEjercicioId || null,
    nombre_ejercicio: programa.nombre,
    foto_url_reportada: fotoUrl,
  });

  // 23505: otro toque simultáneo alcanzó a crear el mismo reporte. Para el
  // alumno el resultado correcto sigue siendo “enviado”.
  if (error && error.code !== "23505") {
    return { error: "No pudimos avisar al entrenador. Intenta nuevamente.", ok: false };
  }

  revalidatePath("/admin/ejercicios");
  return { error: null, ok: true };
}
