import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoRecomendacionImpulso } from "@/lib/supabase/types";
import {
  calcularIntervencionEnVivo,
  calcularIntervencionesEnVivo,
  grupoMuscularPrioritarioDia,
  puntajeCandidatoDestacado,
  MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO,
} from "./en-vivo";
import type { Recomendacion } from "./tipos";

type SupabaseServerClient = SupabaseClient<Database>;

type EjercicioBiblioteca = { categoria: string; grupo_muscular: string; posicion_sesion: string | null };

type ProgramaSesion = {
  orden: number;
  series_programadas: number;
  tecnica_tipo: string | null;
  ejercicio_id: string | null;
  ejercicios: EjercicioBiblioteca | EjercicioBiblioteca[] | null;
};

// PostgREST puede devolver un embed many-to-one como objeto o como array de
// uno segun el camino de relacion que elija; ya se maneja asi en
// impulso-actions.ts. Se centraliza aca para no repetir el Array.isArray.
function unoDeEmbed<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

type RecomendacionCruda = {
  sesion_ejercicio_id: string;
  regla: Recomendacion["regla"];
  peso_sugerido_kg: number | null;
  reps_objetivo_min: number | null;
  reps_objetivo_max: number | null;
  justificacion: string;
  estado: EstadoRecomendacionImpulso;
};

/**
 * Decide que ejercicios de la sesion son los "destacados" con Momento
 * Impulso: los que ya tienen alguna intervencion nunca se sueltan (una vez
 * mostrado, se queda), y los cupos que falten hasta el tope se completan con
 * los mejores candidatos entre los elegibles todavia sin decidir —
 * compuestos y del grupo muscular mas repetido en la sesion, no el orden en
 * que el alumno los alcanza (HANDOFF 1.26, brecha 3). Idempotente: se puede
 * llamar una vez por ejercicio, siempre da el mismo resultado para la misma
 * foto de la base.
 */
async function seleccionarDestacadosSesion(
  supabase: SupabaseServerClient,
  sesionId: string
): Promise<Set<string>> {
  const { data: ejerciciosSesion } = await supabase
    .from("sesion_ejercicios")
    .select(
      "id, rutina_dia_ejercicios(orden, series_programadas, tecnica_tipo, ejercicio_id, ejercicios(categoria, grupo_muscular, posicion_sesion))"
    )
    .eq("sesion_id", sesionId);
  if (!ejerciciosSesion || ejerciciosSesion.length === 0) return new Set();

  const ids = ejerciciosSesion.map((e) => e.id);
  const [{ data: existentes }, { data: recomendaciones }] = await Promise.all([
    supabase.from("impulso_vip_intervenciones").select("sesion_ejercicio_id").in("sesion_ejercicio_id", ids),
    supabase
      .from("impulso_vip_recomendaciones")
      .select("sesion_ejercicio_id, regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, justificacion, estado")
      .in("sesion_ejercicio_id", ids),
  ]);

  const destacados = new Set((existentes ?? []).map((m) => m.sesion_ejercicio_id));
  const cuposLibres = MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO - destacados.size;
  if (cuposLibres <= 0) return destacados;

  const filas = ejerciciosSesion
    .map((fila) => {
      const programa = unoDeEmbed(fila.rutina_dia_ejercicios as unknown as ProgramaSesion | ProgramaSesion[] | null);
      const ejercicio = programa ? unoDeEmbed(programa.ejercicios) : null;
      return { id: fila.id, programa, ejercicio };
    })
    .sort((a, b) => (a.programa?.orden ?? 0) - (b.programa?.orden ?? 0));

  const grupoPrioritarioDia = grupoMuscularPrioritarioDia(
    filas.map((fila) => fila.ejercicio?.grupo_muscular ?? null)
  );
  const recomendacionPorId = new Map(
    (recomendaciones ?? []).map((r) => [r.sesion_ejercicio_id, r as RecomendacionCruda] as const)
  );

  const candidatos = filas
    .filter((fila) => !destacados.has(fila.id) && fila.programa)
    .map((fila) => {
      const programa = fila.programa!;
      const recomendacionCruda = recomendacionPorId.get(fila.id);
      const elegible = recomendacionCruda !== undefined
        && calcularIntervencionEnVivo({
          seriesProgramadas: programa.series_programadas,
          tecnicaProgramada: programa.tecnica_tipo,
          ejercicioVinculado: programa.ejercicio_id !== null,
          recomendacion: {
            regla: recomendacionCruda.regla,
            pesoSugeridoKg: recomendacionCruda.peso_sugerido_kg,
            repsObjetivoMin: recomendacionCruda.reps_objetivo_min,
            repsObjetivoMax: recomendacionCruda.reps_objetivo_max,
            justificacion: recomendacionCruda.justificacion,
            estado: recomendacionCruda.estado,
          },
        }) !== null;
      const puntaje = fila.ejercicio
        ? puntajeCandidatoDestacado(
          {
            categoria: fila.ejercicio.categoria,
            posicionSesion: fila.ejercicio.posicion_sesion,
            grupoMuscular: fila.ejercicio.grupo_muscular,
          },
          grupoPrioritarioDia
        )
        : 0;
      return { id: fila.id, orden: programa.orden, elegible, puntaje };
    })
    .filter((candidato) => candidato.elegible)
    .sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden);

  for (const candidato of candidatos.slice(0, cuposLibres)) {
    destacados.add(candidato.id);
  }
  return destacados;
}

/**
 * Prepara los momentos permitidos de un ejercicio. La politica global limita
 * a tres ejercicios destacados por sesion, elegidos por `seleccionarDestacadosSesion`;
 * dentro de uno largo puede haber orientacion intermedia y un solo reto final.
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

  // Si este ejercicio todavia no tiene ningun momento, la seleccion de
  // destacados de toda la sesion decide si le toca uno. Se puede recalcular
  // sin problema: es idempotente y siempre da el mismo resultado mientras no
  // cambien las filas ya guardadas.
  if (!existentes || existentes.length === 0) {
    const destacados = await seleccionarDestacadosSesion(supabase, contexto.sesion_id);
    if (!destacados.has(params.sesionEjercicioId)) return;
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
