import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rangoRepsObjetivo } from "@/lib/entrenamiento/reps";
import { calcularRecomendacion, esTecnicaExcluida, objetivoAImpulso } from "./motor";
import { seriesLimpiasParaProgresion } from "@/lib/entrenamiento/tecnica-series";
import {
  construirPayloadRecomendacion,
  crearReparadorDeAlertas,
  insertarORecuperarRecomendacion,
} from "./congelar";
import type {
  FilaAlerta,
  FilaRecomendacion,
  PayloadAlerta,
  PayloadRecomendacion,
  RepositorioAlertas,
  RepositorioRecomendaciones,
} from "./congelar";
import type { ConfigProgresion, Dificultad, SesionHistorial } from "./tipos";
import type { Database, DecisionDataImpulso } from "@/lib/supabase/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const ESTADOS_HISTORIAL_VALIDOS = ["completada", "finalizada_incompleta"] as const;
// Ventana máxima de sesiones recientes a revisar antes de filtrar las que no
// tengan series utilizables — un `limit(limite)` sin este margen podría
// devolver menos historial del que realmente existe si las últimas sesiones
// quedaron vacías o canceladas.
const MAX_SESIONES_A_REVISAR = 20;
const ESTADOS_ALERTA_ACTIVA = ["pendiente", "vista"] as const;

/**
 * Config de progresión de un ejercicio asignado. Devuelve null si no hay
 * fila — a propósito no inventa una config por defecto acá; es
 * `generarYGuardarRecomendacion` quien decide qué hacer con "sin config"
 * (no genera recomendación, ver más abajo).
 */
export async function obtenerConfigProgresion(
  supabase: SupabaseServerClient,
  diaEjercicioId: string
): Promise<ConfigProgresion | null> {
  const { data } = await supabase
    .from("rutina_dia_ejercicio_progresion")
    .select("apto_progresion, tipo_progresion, incremento_kg, requiere_autorizacion, rir_objetivo")
    .eq("dia_ejercicio_id", diaEjercicioId)
    .maybeSingle();
  if (!data) return null;

  return {
    aptoProgresion: data.apto_progresion,
    tipoProgresion: data.tipo_progresion,
    incrementoKg: data.incremento_kg,
    requiereAutorizacion: data.requiere_autorizacion,
    rirObjetivo: data.rir_objetivo,
  };
}

interface FilaSerieRealizada {
  sesion_ejercicio_id: string;
  numero_serie: number;
  peso_kg: number | null;
  es_peso_corporal: boolean;
  reps_realizadas: number | null;
  realizada: boolean;
}

/** Una serie solo sirve de referencia para el motor si de verdad se hizo y
 * quedó un número de repeticiones utilizable — una serie marcada "realizada"
 * sin repeticiones cargadas (pasa: "una serie hecha sin cargar número igual
 * cuenta", ver `guardarSeries` en `actions.ts`) no aporta nada para calcular
 * una meta. */
export function esSerieUtilizable(serie: FilaSerieRealizada): boolean {
  return (
    serie.realizada === true &&
    Number.isInteger(serie.numero_serie) &&
    serie.numero_serie > 0 &&
    typeof serie.reps_realizadas === "number" &&
    Number.isFinite(serie.reps_realizadas) &&
    serie.reps_realizadas > 0 &&
    (serie.peso_kg === null ||
      (typeof serie.peso_kg === "number" && Number.isFinite(serie.peso_kg) && serie.peso_kg >= 0))
  );
}

interface FilaSesionEjercicioHistorial {
  id: string;
  dificultad_percibida: Dificultad | null;
  sesiones_entrenamiento:
    | { fecha: string; hora_inicio: string }
    | { fecha: string; hora_inicio: string }[]
    | null;
}

/**
 * Últimas sesiones válidas de este ejercicio ASIGNADO (no del ejercicio de
 * biblioteca — `dia_ejercicio_id` es la fila concreta de `rutina_dia_ejercicios`,
 * así que dos asignaciones distintas del mismo movimiento nunca se mezclan).
 *
 * "Válida" excluye: la sesión actual (`sesionEjercicioActualId`, sin
 * depender de que su estado siga siendo 'en_progreso' — se excluye por id
 * explícitamente), sesiones en curso o abandonadas, y sesiones sin ninguna
 * serie utilizable (vacías o cargadas sin repeticiones reales).
 *
 * Se pide una ventana de hasta `MAX_SESIONES_A_REVISAR` candidatas y se
 * ordena en memoria (fecha desc, hora_inicio desc, id desc como desempate)
 * antes de filtrar y recortar a `limite` — así una racha de sesiones vacías
 * recientes no le hace perder historial real más viejo al motor.
 */
export async function obtenerHistorialParaMotor(
  supabase: SupabaseServerClient,
  alumnoId: string,
  diaEjercicioId: string,
  sesionEjercicioActualId: string,
  limite = 3,
  /** Números de serie que se pueden usar para progresar. `null` = todas, que
   * es el comportamiento de siempre. Se pasa distinto de `null` solo cuando el
   * ejercicio tiene técnica en series puntuales y hay series limpias que sí
   * sirven — ver `seriesLimpiasParaProgresion`. */
  seriesPermitidas: readonly number[] | null = null
): Promise<SesionHistorial[]> {
  const { data } = await supabase
    .from("sesion_ejercicios")
    .select("id, dificultad_percibida, sesiones_entrenamiento!inner(fecha, hora_inicio, alumno_id, estado)")
    .eq("dia_ejercicio_id", diaEjercicioId)
    .neq("id", sesionEjercicioActualId)
    .eq("sesiones_entrenamiento.alumno_id", alumnoId)
    .in("sesiones_entrenamiento.estado", ESTADOS_HISTORIAL_VALIDOS)
    .limit(MAX_SESIONES_A_REVISAR);

  const filas = (data ?? []) as unknown as FilaSesionEjercicioHistorial[];
  if (filas.length === 0) return [];

  type Candidata = { id: string; dificultadPercibida: Dificultad | null; fecha: string; horaInicio: string };
  const candidatas: Candidata[] = [];
  for (const f of filas) {
    const sesion = Array.isArray(f.sesiones_entrenamiento) ? f.sesiones_entrenamiento[0] : f.sesiones_entrenamiento;
    if (!sesion) continue;
    candidatas.push({ id: f.id, dificultadPercibida: f.dificultad_percibida, fecha: sesion.fecha, horaInicio: sesion.hora_inicio });
  }

  candidatas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.horaInicio !== b.horaInicio) return a.horaInicio < b.horaInicio ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  const idsCandidatos = candidatas.map((c) => c.id);
  const consultaSeries = supabase
    .from("series_realizadas")
    .select("sesion_ejercicio_id, numero_serie, peso_kg, es_peso_corporal, reps_realizadas, realizada")
    .in("sesion_ejercicio_id", idsCandidatos);
  const [{ data: series }, { data: alertasDolor }] = await Promise.all([
    // El filtro por serie va en la base y no en memoria: son pocas filas, pero
    // traer las que se van a descartar igual no tiene ninguna ventaja.
    (seriesPermitidas ? consultaSeries.in("numero_serie", [...seriesPermitidas]) : consultaSeries).order(
      "numero_serie",
      { ascending: true }
    ),
    // Solo alertas ACTIVAS bloquean progresión — una ya resuelta no debe
    // seguir pausando al alumno para siempre.
    supabase
      .from("impulso_vip_alertas")
      .select("sesion_ejercicio_id")
      .eq("tipo", "dolor")
      .in("sesion_ejercicio_id", idsCandidatos)
      .in("estado", ESTADOS_ALERTA_ACTIVA),
  ]);

  const seriesPorEjercicio = new Map<string, SesionHistorial["series"]>();
  for (const s of (series ?? []) as FilaSerieRealizada[]) {
    if (!esSerieUtilizable(s)) continue;
    const arr = seriesPorEjercicio.get(s.sesion_ejercicio_id) ?? [];
    arr.push({
      numeroSerie: s.numero_serie,
      pesoKg: s.peso_kg,
      esPesoCorporal: s.es_peso_corporal,
      repsRealizadas: s.reps_realizadas,
      realizada: s.realizada,
    });
    seriesPorEjercicio.set(s.sesion_ejercicio_id, arr);
  }

  // Set, no por alumno: una alerta de dolor pertenece a un `sesion_ejercicio_id`
  // puntual, no "contamina" el resto del historial del alumno.
  const conDolorActivo = new Set((alertasDolor ?? []).map((a) => a.sesion_ejercicio_id as string));

  const historial: SesionHistorial[] = [];
  for (const c of candidatas) {
    const seriesDeEsteEjercicio = (seriesPorEjercicio.get(c.id) ?? []).sort((a, b) => a.numeroSerie - b.numeroSerie);
    // Sin ninguna serie utilizable, esta sesión no cuenta como historial válido.
    if (seriesDeEsteEjercicio.length === 0) continue;

    historial.push({
      sesionEjercicioId: c.id,
      fecha: c.fecha,
      series: seriesDeEsteEjercicio,
      dificultadPercibida: c.dificultadPercibida,
      dolorReportado: conDolorActivo.has(c.id),
    });
    if (historial.length >= limite) break;
  }

  return historial;
}

export interface FilaRecomendacionDB {
  id: string;
  sesion_ejercicio_id: string;
  dia_ejercicio_id: string;
  alumno_id: string;
  regla: FilaRecomendacion["regla"];
  peso_sugerido_kg: number | null;
  reps_objetivo_min: number | null;
  reps_objetivo_max: number | null;
  es_peso_corporal: boolean;
  justificacion: string;
  estado: FilaRecomendacion["estado"];
  cumplimiento: FilaRecomendacion["cumplimiento"];
  decision_data: unknown;
}

export function filaRecomendacionDesdeRow(row: FilaRecomendacionDB): FilaRecomendacion {
  return {
    id: row.id,
    sesionEjercicioId: row.sesion_ejercicio_id,
    diaEjercicioId: row.dia_ejercicio_id,
    alumnoId: row.alumno_id,
    regla: row.regla,
    pesoSugeridoKg: row.peso_sugerido_kg,
    repsObjetivoMin: row.reps_objetivo_min,
    repsObjetivoMax: row.reps_objetivo_max,
    esPesoCorporal: row.es_peso_corporal,
    justificacion: row.justificacion,
    estado: row.estado,
    cumplimiento: row.cumplimiento,
    // Sin cast: `FilaRecomendacion.decisionData` es `unknown` a propósito
    // (ver congelar.ts) — lo único que lo lee es `leerAlertaTipo`, que valida
    // antes de devolver algo en vez de confiar ciegamente en la forma del jsonb.
    decisionData: row.decision_data,
  };
}

const COLUMNAS_RECOMENDACION =
  "id, sesion_ejercicio_id, dia_ejercicio_id, alumno_id, regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, es_peso_corporal, justificacion, estado, cumplimiento, decision_data";

function crearRepositorioRecomendaciones(supabase: SupabaseServerClient): RepositorioRecomendaciones {
  return {
    async buscar(sesionEjercicioId) {
      const { data } = await supabase
        .from("impulso_vip_recomendaciones")
        .select(COLUMNAS_RECOMENDACION)
        .eq("sesion_ejercicio_id", sesionEjercicioId)
        .maybeSingle();
      return data ? filaRecomendacionDesdeRow(data as unknown as FilaRecomendacionDB) : null;
    },
    async insertar(payload: PayloadRecomendacion) {
      // Se arma el objeto explícito (no `payload` tal cual) para que
      // cualquier columna nueva, renombrada o con otra nulabilidad en
      // `impulso_vip_recomendaciones` siga generando un error de tipos acá.
      // El único límite tipado → JSON genérico es `decision_data`: lo
      // construye `construirPayloadRecomendacion` con una forma conocida y
      // sabemos que es serializable (sin `undefined`/`NaN`/`Date`), así que
      // el cast queda acotado a ese único campo.
      const filaInsert: Database["public"]["Tables"]["impulso_vip_recomendaciones"]["Insert"] = {
        sesion_ejercicio_id: payload.sesion_ejercicio_id,
        dia_ejercicio_id: payload.dia_ejercicio_id,
        alumno_id: payload.alumno_id,
        regla: payload.regla,
        peso_sugerido_kg: payload.peso_sugerido_kg,
        reps_objetivo_min: payload.reps_objetivo_min,
        reps_objetivo_max: payload.reps_objetivo_max,
        es_peso_corporal: payload.es_peso_corporal,
        justificacion: payload.justificacion,
        basado_en_sesion_ejercicio_id: payload.basado_en_sesion_ejercicio_id,
        estado: payload.estado,
        motor_version: payload.motor_version,
        decision_data: payload.decision_data as unknown as DecisionDataImpulso,
      };
      const { data, error } = await supabase
        .from("impulso_vip_recomendaciones")
        .insert(filaInsert)
        .select(COLUMNAS_RECOMENDACION)
        .single();
      if (error) {
        // 23505 = unique_violation: alguien más insertó la misma
        // `sesion_ejercicio_id` entre que este proceso comprobó que no
        // existía y este intento de insert — es la única traducción de un
        // error real de Postgres en toda la capa de Impulso VIP.
        if (error.code === "23505") return { tipo: "conflicto" as const };
        throw new Error(`No fue posible guardar la recomendación de Impulso VIP: ${error.message}`);
      }
      return { tipo: "insertada" as const, fila: filaRecomendacionDesdeRow(data as unknown as FilaRecomendacionDB) };
    },
  };
}

function crearRepositorioAlertas(supabase: SupabaseServerClient): RepositorioAlertas {
  const columnas = "id, sesion_ejercicio_id, tipo, estado";
  return {
    async buscar(sesionEjercicioId, tipo) {
      const { data } = await supabase
        .from("impulso_vip_alertas")
        .select(columnas)
        .eq("sesion_ejercicio_id", sesionEjercicioId)
        .eq("tipo", tipo)
        .maybeSingle();
      return data ? filaAlertaDesdeRow(data) : null;
    },
    async insertar(payload: PayloadAlerta) {
      const { data, error } = await supabase.from("impulso_vip_alertas").insert(payload).select(columnas).single();
      if (error) {
        if (error.code === "23505") return { tipo: "conflicto" as const };
        throw new Error(`No fue posible guardar la alerta de Impulso VIP: ${error.message}`);
      }
      return { tipo: "insertada" as const, fila: filaAlertaDesdeRow(data) };
    },
  };
}

/** La columna `sesion_ejercicio_id` es nullable en el esquema (alertas
 * futuras podrían no atarse a un ejercicio puntual), pero todo el flujo de
 * reparación de Impulso VIP trabaja únicamente con alertas asociadas a una
 * sesión concreta — esa diferencia de dominio vive acá, en el adaptador. */
export const ERROR_ALERTA_SIN_SESION = "Alerta de Impulso VIP sin sesión de ejercicio asociada.";

export function filaAlertaDesdeRow(row: {
  id: string;
  sesion_ejercicio_id: string | null;
  tipo: FilaAlerta["tipo"];
  estado: FilaAlerta["estado"];
}): FilaAlerta {
  if (!row.sesion_ejercicio_id) {
    throw new Error(ERROR_ALERTA_SIN_SESION);
  }
  return { id: row.id, sesionEjercicioId: row.sesion_ejercicio_id, tipo: row.tipo, estado: row.estado };
}

/**
 * Genera (una única vez) la recomendación de Impulso VIP para un ejercicio de
 * la sesión, o la devuelve si ya existía — nunca la recalcula sobre una fila
 * ya persistida (ver `insertarORecuperarRecomendacion` en congelar.ts).
 *
 * Devuelve null cuando no corresponde generar recomendación: sin
 * configuración de progresión, progresión desactivada para este ejercicio,
 * técnica excluida (superserie/dropset/etc — ver `esTecnicaExcluida`),
 * rango de repeticiones no interpretable (incluye ejercicios "por tiempo" —
 * ver `rangoRepsObjetivo`), o sin ningún historial válido todavía (la
 * primera vez que se hace el ejercicio, el alumno sigue el rango que ya le
 * dio el entrenador; Impulso VIP arranca desde la segunda sesión, cuando ya
 * hay una referencia real).
 */
export async function generarYGuardarRecomendacion(
  supabase: SupabaseServerClient,
  params: {
    sesionEjercicioId: string;
    diaEjercicioId: string;
    alumnoId: string;
    /**
     * Objetivo del alumno ya leído por quien llama, para no repetir la misma
     * consulta una vez por ejercicio.
     *
     * Esto se corre en paralelo para TODOS los ejercicios de la sesión al
     * crearla, así que `alumno_perfil` se pedía diez veces seguidas para
     * devolver diez veces la misma fila. Envuelto en un objeto y no suelto
     * porque el objetivo puede ser `null` legítimamente: hay que poder
     * distinguir "no me lo pasaron" de "me pasaron que no tiene".
     */
    objetivoAlumno?: { valor: string | null };
    /**
     * La sesión se acaba de crear y sus ejercicios son nuevos: no puede haber
     * una recomendación previa, así que se saltea la búsqueda inicial —otra
     * consulta por ejercicio que en este camino siempre volvía vacía—. No hay
     * carrera que perder: `insertarORecuperarRecomendacion` ya resuelve el
     * conflicto si dos pedidos llegan juntos.
     */
    sesionRecienCreada?: boolean;
  }
): Promise<FilaRecomendacion | null> {
  const { sesionEjercicioId, diaEjercicioId, alumnoId, objetivoAlumno, sesionRecienCreada } = params;
  const repoRecomendaciones = crearRepositorioRecomendaciones(supabase);
  const repararAlerta = crearReparadorDeAlertas(crearRepositorioAlertas(supabase));

  // Búsqueda inicial ÚNICA: si ya existe, ni siquiera se consulta config ni
  // historial — solo se repara la alerta (por si un intento anterior guardó
  // la recomendación pero falló al crear su alerta) y se devuelve.
  if (!sesionRecienCreada) {
    const existente = await repoRecomendaciones.buscar(sesionEjercicioId);
    if (existente) {
      await repararAlerta(existente);
      return existente;
    }
  }

  const [{ data: ejercicio }, objetivoTexto, config] = await Promise.all([
    supabase
      .from("rutina_dia_ejercicios")
      .select("reps_programadas, series_programadas, tecnica_tipo, tecnica_series")
      .eq("id", diaEjercicioId)
      .maybeSingle(),
    objetivoAlumno
      ? Promise.resolve(objetivoAlumno.valor)
      : supabase
          .from("alumno_perfil")
          .select("objetivo")
          .eq("user_id", alumnoId)
          .maybeSingle()
          .then(({ data }) => data?.objetivo ?? null),
    obtenerConfigProgresion(supabase, diaEjercicioId),
  ]);

  if (!ejercicio || !config || !config.aptoProgresion) return null;

  /**
   * Técnica en series puntuales: el ejercicio ya no se excluye entero.
   *
   * Antes, cualquier técnica mataba la progresión del ejercicio completo —
   * correcto mientras la técnica cubriera todas las series, porque el número
   * no era comparable contra el historial. Con la migración 0073 la técnica
   * puede ir en una sola serie, y las otras siguen siendo series normales.
   *
   * `seriesLimpiasParaProgresion` decide: devuelve las series que sirven, o
   * `null` si hay que excluir igual (técnica en todo el ejercicio, técnica en
   * la serie 1 o 2 que deja fatigadas a las siguientes, o menos de dos series
   * limpias). Ver la regla completa y su porqué en ese módulo y en el
   * HANDOFF 1.20.
   */
  let seriesPermitidas: number[] | null = null;
  if (esTecnicaExcluida(ejercicio.tecnica_tipo)) {
    seriesPermitidas = seriesLimpiasParaProgresion(
      ejercicio.tecnica_series,
      ejercicio.series_programadas
    );
    if (!seriesPermitidas) return null;
  }

  const rango = rangoRepsObjetivo(ejercicio.reps_programadas);
  if (!rango) return null;

  const historial = await obtenerHistorialParaMotor(
    supabase,
    alumnoId,
    diaEjercicioId,
    sesionEjercicioId,
    3,
    seriesPermitidas
  );
  if (historial.length === 0) return null;

  const objetivo = objetivoAImpulso(objetivoTexto);
  // Las series que de verdad entran al cálculo. Importa porque el motor arma
  // la meta como `seriesProgramadas * rango.min`: si el ejercicio tiene 4
  // series pero solo 3 son limpias, pedir 4 × el mínimo sería pedirle al
  // alumno un total que sus 3 series contadas no pueden alcanzar nunca.
  const seriesEfectivas = seriesPermitidas ? seriesPermitidas.length : ejercicio.series_programadas;
  const recomendacion = calcularRecomendacion({
    objetivo,
    rango,
    seriesProgramadas: seriesEfectivas,
    config,
    historialUltimasSesiones: historial,
  });

  const payload = construirPayloadRecomendacion({
    sesionEjercicioId,
    diaEjercicioId,
    alumnoId,
    objetivo,
    rango,
    seriesProgramadas: seriesEfectivas,
    config,
    historial,
    recomendacion,
    seriesConsideradas: seriesPermitidas,
  });

  return insertarORecuperarRecomendacion(repoRecomendaciones, payload, repararAlerta);
}

export type AlertaPendiente = {
  id: string;
  tipo: "dolor" | "estancamiento_3_sesiones" | "caida_rendimiento";
  estado: "pendiente" | "vista";
  ejercicioNombre: string;
  zona: string | null;
  intensidad: number | null;
  momento: "antes" | "durante" | "despues" | null;
  detuvoEjercicio: boolean | null;
  detalle: string | null;
  creadoEn: string;
};

/** Alertas activas (pendiente o vista, nunca resuelta) de un alumno para la
 * ficha del entrenador — panel mínimo de Fase 1, sin página global todavía
 * (ver AGENTS del proyecto: eso queda para una fase posterior). */
// El select se arma con plantilla, así que el parser de tipos de PostgREST
// no puede inferir la forma del resultado (mismo caso que en
// `obtenerSesionCompleta`, src/app/alumno/entrenar/data.ts) — se declara a mano.
type FilaAlertaPendiente = {
  id: string;
  tipo: AlertaPendiente["tipo"];
  estado: AlertaPendiente["estado"];
  zona: string | null;
  intensidad: number | null;
  momento: AlertaPendiente["momento"];
  detuvo_ejercicio: boolean | null;
  detalle: string | null;
  creado_en: string;
  rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
};

export async function obtenerAlertasPendientes(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<AlertaPendiente[]> {
  const { data } = await supabase
    .from("impulso_vip_alertas")
    .select(
      "id, tipo, estado, zona, intensidad, momento, detuvo_ejercicio, detalle, creado_en, rutina_dia_ejercicios(nombre)"
    )
    .eq("alumno_id", alumnoId)
    .in("estado", ESTADOS_ALERTA_ACTIVA)
    .order("creado_en", { ascending: false });

  return ((data ?? []) as unknown as FilaAlertaPendiente[]).map((a) => {
    const ejercicio = Array.isArray(a.rutina_dia_ejercicios) ? a.rutina_dia_ejercicios[0] : a.rutina_dia_ejercicios;
    return {
      id: a.id,
      tipo: a.tipo,
      estado: a.estado,
      ejercicioNombre: ejercicio?.nombre ?? "Ejercicio",
      zona: a.zona,
      intensidad: a.intensidad,
      momento: a.momento,
      detuvoEjercicio: a.detuvo_ejercicio,
      detalle: a.detalle,
      creadoEn: a.creado_en,
    };
  });
}
