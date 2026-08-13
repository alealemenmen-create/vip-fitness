import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoRecomendacionImpulso } from "@/lib/supabase/types";
import { calcularIntervencionesEnVivo, MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO } from "./en-vivo";
import type { Recomendacion } from "./tipos";

type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Prepara los momentos permitidos de un ejercicio. La politica global limita
 * a tres ejercicios destacados por sesion; dentro de uno largo puede haber
 * orientacion intermedia y un solo reto final.
 */
export async function asegurarIntervencionEnVivo(
  supabase: SupabaseServerClient,
  params: { sesionEjercicioId: string; alumnoId: string }
): Promise<void> {
  const [{ data: existentes }, { data: contexto }, { data: recomendacion }] = await Promise.all([
    supabase
      .from("impulso_vip_intervenciones")
      .select("id, serie_objetivo")
      .eq("sesion_ejercicio_id", params.sesionEjercicioId),
    supabase
      .from("sesion_ejercicios")
      .select(
        "id, sesion_id, rutina_dia_ejercicios(series_programadas, tecnica_tipo, ejercicio_id)"
      )
      .eq("id", params.sesionEjercicioId)
      .maybeSingle(),
    // La tabla tiene dos FK hacia sesion_ejercicios. Consultarla directamente
    // evita que PostgREST tenga que adivinar cual relacion usar en un embed.
    supabase
      .from("impulso_vip_recomendaciones")
      .select("regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, justificacion, estado")
      .eq("sesion_ejercicio_id", params.sesionEjercicioId)
      .maybeSingle(),
  ]);
  if (!contexto) return;

  const programa = contexto.rutina_dia_ejercicios as unknown as {
    series_programadas: number;
    tecnica_tipo: string | null;
    ejercicio_id: string | null;
  } | null;
  const recomendacionTipada = recomendacion as unknown as {
    regla: Recomendacion["regla"];
    peso_sugerido_kg: number | null;
    reps_objetivo_min: number | null;
    reps_objetivo_max: number | null;
    justificacion: string;
    estado: EstadoRecomendacionImpulso;
  } | null;
  if (!programa || !recomendacionTipada) return;

  // Si este ejercicio todavia no tiene ningun momento, primero comprueba el
  // limite de la sesion. La creacion y la reparacion llaman esta funcion en
  // orden para que el resultado sea estable y no dependa de carreras.
  if (!existentes || existentes.length === 0) {
    const { data: ejerciciosSesion } = await supabase
      .from("sesion_ejercicios")
      .select("id")
      .eq("sesion_id", contexto.sesion_id);
    const ids = (ejerciciosSesion ?? []).map((e) => e.id);
    if (ids.length > 0) {
      const { data: momentosSesion } = await supabase
        .from("impulso_vip_intervenciones")
        .select("sesion_ejercicio_id")
        .in("sesion_ejercicio_id", ids);
      const destacados = new Set((momentosSesion ?? []).map((m) => m.sesion_ejercicio_id));
      if (destacados.size >= MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO) return;
    }
  }

  const calculadas = calcularIntervencionesEnVivo({
    seriesProgramadas: programa.series_programadas,
    tecnicaProgramada: programa.tecnica_tipo,
    ejercicioVinculado: programa.ejercicio_id !== null,
    recomendacion: {
      regla: recomendacionTipada.regla,
      pesoSugeridoKg: recomendacionTipada.peso_sugerido_kg,
      repsObjetivoMin: recomendacionTipada.reps_objetivo_min,
      repsObjetivoMax: recomendacionTipada.reps_objetivo_max,
      justificacion: recomendacionTipada.justificacion,
      estado: recomendacionTipada.estado,
    },
  });
  const seriesExistentes = new Set((existentes ?? []).map((e) => e.serie_objetivo));
  const faltantes = calculadas.filter((i) => !seriesExistentes.has(i.serieObjetivo));
  if (faltantes.length === 0) return;

  const { error } = await supabase.from("impulso_vip_intervenciones").insert(
    faltantes.map((calculada) => ({
      sesion_ejercicio_id: params.sesionEjercicioId,
      alumno_id: params.alumnoId,
      serie_objetivo: calculada.serieObjetivo,
      tipo: calculada.tipo,
      origen: "metodo_ale" as const,
      firma: calculada.firma,
      instruccion: calculada.instruccion,
      motivo: calculada.motivo,
      prescripcion: calculada.prescripcion,
      motor_version: "en_vivo_v1",
      decision_data: calculada.decisionData,
    }))
  );
  // 23505: otra peticion la creo entre la consulta y el insert.
  if (error && error.code !== "23505") throw error;
}
