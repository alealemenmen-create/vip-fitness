import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoIntervencionImpulso } from "@/lib/supabase/types";

type Cliente = SupabaseClient<Database>;

export type ObjetivoIndicacionAle = {
  diaEjercicioId: string;
  dia: string;
  ejercicio: string;
  series: number;
  sesionEjercicioId: string | null;
};

export type IndicacionAlePendiente = {
  id: string;
  objetivo: string;
  serie: number;
  tipo: TipoIntervencionImpulso;
  instruccion: string;
};

export async function obtenerPanelIndicacionesAle(
  supabase: Cliente,
  alumnoId: string,
): Promise<{ objetivos: ObjetivoIndicacionAle[]; pendientes: IndicacionAlePendiente[] }> {
  const [{ data: asignaciones }, { data: sesionActiva }, { data: pendientes }] = await Promise.all([
    supabase
      .from("rutina_dia_ejercicios")
      .select("id, nombre, series_programadas, orden, rutina_dias!inner(nombre, orden, rutinas!inner(alumno_id, activa))")
      .eq("rutina_dias.rutinas.alumno_id", alumnoId)
      .eq("rutina_dias.rutinas.activa", true)
      .order("orden"),
    supabase
      .from("sesiones_entrenamiento")
      .select("id, sesion_ejercicios(id, dia_ejercicio_id)")
      .eq("alumno_id", alumnoId)
      .eq("estado", "en_progreso")
      .not("rutina_iniciada_en", "is", null)
      .order("hora_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("impulso_vip_indicaciones_programadas")
      .select("id, serie_objetivo, tipo, instruccion, rutina_dia_ejercicios(nombre)")
      .eq("alumno_id", alumnoId)
      .eq("estado", "pendiente")
      .order("creada_en", { ascending: false }),
  ]);

  const activos = new Map(
    ((sesionActiva?.sesion_ejercicios ?? []) as { id: string; dia_ejercicio_id: string }[])
      .map((fila) => [fila.dia_ejercicio_id, fila.id]),
  );
  type FilaAsignacion = {
    id: string; nombre: string; series_programadas: number; orden: number;
    rutina_dias: { nombre: string; orden: number } | { nombre: string; orden: number }[];
  };
  const objetivosOrdenados = ((asignaciones ?? []) as unknown as FilaAsignacion[])
    .map((fila) => {
      const dia = Array.isArray(fila.rutina_dias) ? fila.rutina_dias[0] : fila.rutina_dias;
      return {
        diaEjercicioId: fila.id,
        dia: dia?.nombre ?? "Sesión",
        ejercicio: fila.nombre,
        series: fila.series_programadas,
        sesionEjercicioId: activos.get(fila.id) ?? null,
        ordenDia: dia?.orden ?? 0,
        orden: fila.orden,
      };
    })
    .sort((a, b) => a.ordenDia - b.ordenDia || a.orden - b.orden);
  const objetivos: ObjetivoIndicacionAle[] = objetivosOrdenados.map((fila) => ({
    diaEjercicioId: fila.diaEjercicioId,
    dia: fila.dia,
    ejercicio: fila.ejercicio,
    series: fila.series,
    sesionEjercicioId: fila.sesionEjercicioId,
  }));

  type FilaPendiente = {
    id: string; serie_objetivo: number; tipo: TipoIntervencionImpulso; instruccion: string;
    rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
  };
  return {
    objetivos,
    pendientes: ((pendientes ?? []) as unknown as FilaPendiente[]).map((fila) => ({
      id: fila.id,
      objetivo: (Array.isArray(fila.rutina_dia_ejercicios) ? fila.rutina_dia_ejercicios[0]?.nombre : fila.rutina_dia_ejercicios?.nombre) ?? "Ejercicio",
      serie: fila.serie_objetivo,
      tipo: fila.tipo,
      instruccion: fila.instruccion,
    })),
  };
}

/** Se llama antes de crear momentos automáticos: la voz personal de Ale
 * ocupa primero la serie y el motor automático respeta ese lugar. */
export async function entregarIndicacionesProgramadas(
  supabase: Cliente,
  params: { alumnoId: string; sesionEjercicios: { id: string; dia_ejercicio_id: string }[] },
): Promise<void> {
  const ids = params.sesionEjercicios.map((fila) => fila.dia_ejercicio_id);
  if (ids.length === 0) return;
  const { data } = await supabase
    .from("impulso_vip_indicaciones_programadas")
    .select("id, dia_ejercicio_id, serie_objetivo, tipo, instruccion, prescripcion")
    .eq("alumno_id", params.alumnoId)
    .eq("estado", "pendiente")
    .in("dia_ejercicio_id", ids);
  const [{ data: ficha }, { data: perfilesEjercicio }] = await Promise.all([
    supabase.from("perfiles_entrenamiento")
      .select("lesiones_diagnosticadas, condiciones_medicas, requiere_revision")
      .eq("alumno_id", params.alumnoId).maybeSingle(),
    supabase.from("rutina_dia_ejercicios")
      .select("id, ejercicio_id, ejercicios(impulso_perfil_revisado, impulso_tecnicas_permitidas)")
      .in("id", ids),
  ]);
  type Seguridad = { impulso_perfil_revisado: boolean; impulso_tecnicas_permitidas: string[] };
  type AsignacionSeguridad = { id: string; ejercicio_id: string | null; ejercicios: Seguridad | Seguridad[] | null };
  const seguridadPorAsignacion = new Map(((perfilesEjercicio ?? []) as unknown as AsignacionSeguridad[]).map((fila) => {
    const perfil = Array.isArray(fila.ejercicios) ? fila.ejercicios[0] ?? null : fila.ejercicios;
    return [fila.id, { ejercicioId: fila.ejercicio_id, perfil }] as const;
  }));
  const restriccionMedica = !ficha || ficha.requiere_revision || !!ficha.lesiones_diagnosticadas?.trim() || !!ficha.condiciones_medicas?.trim();
  const sesionPorAsignacion = new Map(params.sesionEjercicios.map((fila) => [fila.dia_ejercicio_id, fila.id]));
  for (const indicacion of data ?? []) {
    const intensa = indicacion.tipo === "drop_set" || indicacion.tipo === "rest_pause" || indicacion.tipo === "fallo_controlado";
    const seguridad = seguridadPorAsignacion.get(indicacion.dia_ejercicio_id);
    if (intensa && (restriccionMedica || !seguridad?.ejercicioId || !seguridad.perfil?.impulso_perfil_revisado || !seguridad.perfil.impulso_tecnicas_permitidas.includes(indicacion.tipo))) {
      await supabase.from("impulso_vip_indicaciones_programadas").update({ estado: "cancelada" }).eq("id", indicacion.id);
      continue;
    }
    const sesionEjercicioId = sesionPorAsignacion.get(indicacion.dia_ejercicio_id);
    if (!sesionEjercicioId) continue;
    const { data: existente } = await supabase.from("impulso_vip_intervenciones")
      .select("id, estado, origen").eq("sesion_ejercicio_id", sesionEjercicioId)
      .eq("serie_objetivo", indicacion.serie_objetivo).maybeSingle();
    if (existente && existente.estado !== "preparada") continue;
    const valores = {
      tipo: indicacion.tipo,
      origen: "personal_ale" as const,
      firma: "Ale Mendoza · tu entrenador",
      instruccion: indicacion.instruccion,
      motivo: "Indicación preparada personalmente por Alejandro para esta sesión.",
      prescripcion: indicacion.prescripcion,
      motor_version: "manual_ale_v1",
      decision_data: { indicacionProgramadaId: indicacion.id },
    };
    const { data: creada, error } = existente
      ? await supabase.from("impulso_vip_intervenciones").update(valores).eq("id", existente.id)
          .eq("estado", "preparada").select("id").single()
      : await supabase.from("impulso_vip_intervenciones").insert({
          ...valores,
          sesion_ejercicio_id: sesionEjercicioId,
          alumno_id: params.alumnoId,
          serie_objetivo: indicacion.serie_objetivo,
        }).select("id").single();
    if (error || !creada) continue;
    await supabase.from("impulso_vip_indicaciones_programadas").update({
      estado: "entregada",
      entregada_en: new Date().toISOString(),
      intervencion_id: creada.id,
    }).eq("id", indicacion.id).eq("estado", "pendiente");
  }
}
