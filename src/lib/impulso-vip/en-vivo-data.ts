import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoRecomendacionImpulso } from "@/lib/supabase/types";
import { calcularIntervencionesEnVivo, resolverCupoImpulsoSesion } from "./en-vivo";
import type { Recomendacion } from "./tipos";

type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Prepara los momentos permitidos de un ejercicio. La politica global limita
 * al cupo adaptativo del alumno: uno por defecto y dos solo cuando viene
 * cumpliendo retos con datos verificables. Dentro de uno largo puede haber
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

  // El nivel se calcula a partir de retos ya cerrados, no por el peso
  // absoluto. Así un alumno pequeño y uno fuerte reciben la misma evaluación
  // justa: cumplir su propia prescripción con datos completos.
  const { data: retosRecientes } = await supabase
    .from("impulso_vip_intervenciones")
    .select("resultado, verificacion")
    .eq("alumno_id", params.alumnoId)
    .eq("estado", "resuelta")
    .order("resuelta_en", { ascending: false })
    .limit(4);
  const cupoSesion = resolverCupoImpulsoSesion(retosRecientes ?? []);

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
      if (destacados.size >= cupoSesion) return;
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

/** Umbral de "ya no es nuevo" — confirmado con Alejandro: 5 sesiones de
 * historial, contadas en sesiones (no en días de calendario, porque varía
 * cuánto entrena cada alumno por semana). */
const SESIONES_MINIMAS_PARA_GARANTIA = 5;

/**
 * Garantiza al menos UN momento Impulso VIP en la sesión para alumnos que ya
 * vienen entrenando y registrando en serio — nunca para alguien que recién
 * arranca (ahí no hay de dónde partir, y forzar algo sería ilógico, tal cual
 * lo pidió Alejandro).
 *
 * Se llama DESPUÉS de que `asegurarIntervencionEnVivo` ya recorrió todos los
 * ejercicios de la sesión con las reglas normales (recomendación aprobada,
 * 3+ series, sin técnica ya asignada...). Si por la combinación de ejercicios
 * de ese día ninguno terminó calificando, esto elige el último ejercicio
 * elegible (3+ series, sin técnica del entrenador) y fuerza un cierre
 * controlado ahí — es la estrategia de conexión del entrenador con el
 * alumno, no un adorno: "que no digan que este juego está sentado ahí y
 * solo los ve".
 */
export async function garantizarMomentoMinimoSesion(
  supabase: SupabaseServerClient,
  params: {
    alumnoId: string;
    sesionId: string;
    /** Ejercicios de la sesión, ya en orden de rutina. */
    sesionEjercicios: { id: string; seriesProgramadas: number; tecnicaTipo: string | null }[];
  }
): Promise<void> {
  const ids = params.sesionEjercicios.map((e) => e.id);
  if (ids.length === 0) return;

  const { data: existentes } = await supabase
    .from("impulso_vip_intervenciones")
    .select("sesion_ejercicio_id")
    .in("sesion_ejercicio_id", ids);
  if (existentes && existentes.length > 0) return; // ya hay al menos uno, nada que forzar.

  const { count: sesionesPrevias } = await supabase
    .from("sesiones_entrenamiento")
    .select("id", { count: "exact", head: true })
    .eq("alumno_id", params.alumnoId)
    .neq("id", params.sesionId)
    .in("estado", ["completada", "finalizada_incompleta"]);
  if (!sesionesPrevias || sesionesPrevias < SESIONES_MINIMAS_PARA_GARANTIA) return;

  // El último ejercicio elegible del día, no el primero: es el que queda
  // más fresco en la sesión y coincide con el criterio que ya usa el motor
  // normal (el cierre suele ir en la última serie del ejercicio).
  const elegible = [...params.sesionEjercicios]
    .reverse()
    .find((e) => e.seriesProgramadas >= 3 && !e.tecnicaTipo?.trim());
  if (!elegible) return;

  const { error } = await supabase.from("impulso_vip_intervenciones").insert({
    sesion_ejercicio_id: elegible.id,
    alumno_id: params.alumnoId,
    serie_objetivo: elegible.seriesProgramadas,
    tipo: "cierre_controlado",
    origen: "metodo_ale",
    firma: "Metodo de Ale Mendoza",
    instruccion:
      "Esta es la serie que cuenta: busca superar tu ejecución anterior sin perder recorrido ni control. Si la técnica se rompe, detente.",
    motivo: "Garantía mínima de sesión: llevas historial suficiente como para que hoy también haya un momento Impulso VIP.",
    prescripcion: { detenerSiPierdeTecnica: true },
    motor_version: "en_vivo_v1",
    decision_data: { origenDecision: "garantia_minima_sesion" },
  });
  // 23505: otra peticion ya lo creo.
  if (error && error.code !== "23505") throw error;
}
