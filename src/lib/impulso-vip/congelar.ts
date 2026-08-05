import { MOTOR_VERSION } from "./tipos";
import type {
  AlertaTipo,
  ConfigProgresion,
  Cumplimiento,
  MotivoDecision,
  ObjetivoProgresion,
  RangoReps,
  Recomendacion,
  ReglaImpulso,
  SesionHistorial,
} from "./tipos";

export type EstadoRecomendacion = "propuesta" | "aprobada" | "bloqueada" | "modificada";
export type EstadoAlerta = "pendiente" | "vista" | "resuelta";

/** Mensajes estables — se comparan por igualdad exacta en los tests y sirven
 * para observabilidad/manejo de errores más adelante. Nunca les agregamos
 * IDs interpolados: eso los volvería impredecibles de testear y loguear. */
export const ERROR_ALERTA_TIPO_INVALIDO = "Recomendación E_consultar sin un tipo de alerta válido.";
export const ERROR_CONFLICTO_RECOMENDACION =
  "Conflicto al crear la recomendación, pero no fue posible recuperar la fila persistida.";
export const ERROR_CONFLICTO_ALERTA = "Conflicto al crear la alerta, pero no fue posible recuperar la fila persistida.";

/** Resultado abstracto de un intento de insert — a propósito no sabe nada de
 * Postgres ni de códigos de error como `23505`. El adaptador de Supabase (en
 * `data.ts`) es quien traduce un unique_violation real a `{ tipo: "conflicto" }`;
 * este módulo no importa nada de Supabase para poder testearse con un
 * repositorio falso en memoria. */
export type ResultadoInsercion<T> = { tipo: "insertada"; fila: T } | { tipo: "conflicto" };

/** Snapshot de la decisión, tal como queda en `decision_data`. `alertaTipo`
 * viaja acá (no solo en el objeto `Recomendacion` en memoria) porque es lo
 * único que sobrevive cuando se relee la fila desde la base para reparar una
 * alerta faltante — ver `leerAlertaTipo`. */
export interface DecisionData {
  objetivo: ObjetivoProgresion;
  rangoOriginal: RangoReps;
  seriesProgramadas: number;
  tipoProgresion: string;
  incrementoKg: number;
  pesoAnteriorKg: number | null;
  repsAnterioresPorSerie: (number | null)[];
  totalAnteriorReps: number | null;
  metaTotalReps: number | null;
  sesionesHistoricasValidas: number;
  dificultadAnterior: string | null;
  esPesoCorporal: boolean;
  motivos: MotivoDecision[];
  alertaTipo: AlertaTipo | null;
  basadoEnSesionEjercicioId: string | null;
  basadoEnFecha: string | null;
}

/** Fila tal como queda persistida (nombres en camelCase). Interfaz completa
 * a propósito — los campos que la UI necesita (peso sugerido, rango de
 * reps, justificación, cumplimiento) siguen acá; lo que cambia según el
 * caso de uso es cuáles de estos campos importan en cada función, no el
 * tipo en sí. */
export interface FilaRecomendacion {
  id: string;
  sesionEjercicioId: string;
  diaEjercicioId: string;
  alumnoId: string;
  regla: ReglaImpulso;
  pesoSugeridoKg: number | null;
  repsObjetivoMin: number | null;
  repsObjetivoMax: number | null;
  esPesoCorporal: boolean;
  justificacion: string;
  estado: EstadoRecomendacion;
  cumplimiento: Cumplimiento | null;
  // `unknown`, no `DecisionData`: esto viene de un jsonb leído de Supabase,
  // nunca validado campo por campo al leerlo. Lo único que se lee de acá es
  // `alertaTipo`, siempre a través de `leerAlertaTipo` (que sí valida antes
  // de devolver algo). El lado de escritura (`PayloadRecomendacion.decision_data`
  // más abajo) sí es `DecisionData` fuerte porque lo construimos nosotros.
  decisionData: unknown;
}

/** Payload en snake_case, tal como lo espera la tabla `impulso_vip_recomendaciones`. */
export interface PayloadRecomendacion {
  sesion_ejercicio_id: string;
  dia_ejercicio_id: string;
  alumno_id: string;
  regla: ReglaImpulso;
  peso_sugerido_kg: number | null;
  reps_objetivo_min: number | null;
  reps_objetivo_max: number | null;
  es_peso_corporal: boolean;
  justificacion: string;
  basado_en_sesion_ejercicio_id: string | null;
  estado: EstadoRecomendacion;
  motor_version: string;
  decision_data: DecisionData;
}

export interface RepositorioRecomendaciones {
  buscar(sesionEjercicioId: string): Promise<FilaRecomendacion | null>;
  insertar(payload: PayloadRecomendacion): Promise<ResultadoInsercion<FilaRecomendacion>>;
}

export interface FilaAlerta {
  id: string;
  sesionEjercicioId: string;
  tipo: AlertaTipo;
  estado: EstadoAlerta;
}

export interface PayloadAlerta {
  alumno_id: string;
  dia_ejercicio_id: string;
  sesion_ejercicio_id: string;
  tipo: AlertaTipo;
}

export interface RepositorioAlertas {
  buscar(sesionEjercicioId: string, tipo: AlertaTipo): Promise<FilaAlerta | null>;
  insertar(payload: PayloadAlerta): Promise<ResultadoInsercion<FilaAlerta>>;
}

function pesoMaximo(series: SesionHistorial["series"]): number | null {
  const pesos = series.filter((s) => s.pesoKg !== null).map((s) => s.pesoKg as number);
  return pesos.length ? Math.max(...pesos) : null;
}

function totalRepsRealizadas(series: SesionHistorial["series"]): number {
  return series.reduce((acc, s) => acc + (s.realizada ? (s.repsRealizadas ?? 0) : 0), 0);
}

/**
 * Arma el payload a insertar — pura, sin Supabase. `decision_data` guarda
 * todo lo necesario para auditar por qué se decidió esta recomendación (y
 * para reparar su alerta si hace falta releerla después), incluso si el
 * entrenador cambia más tarde el rango o el incremento configurado.
 */
export function construirPayloadRecomendacion(args: {
  sesionEjercicioId: string;
  diaEjercicioId: string;
  alumnoId: string;
  objetivo: ObjetivoProgresion;
  rango: RangoReps;
  seriesProgramadas: number;
  config: ConfigProgresion;
  historial: SesionHistorial[];
  recomendacion: Recomendacion;
}): PayloadRecomendacion {
  const { sesionEjercicioId, diaEjercicioId, alumnoId, objetivo, rango, seriesProgramadas, config, historial, recomendacion } =
    args;
  // El historial ya debe venir ordenado del más reciente al más antiguo
  // (ver `obtenerHistorialParaMotor` en data.ts) — acá solo se toma el primero.
  const ultima = historial[0] as SesionHistorial | undefined;

  let estado: EstadoRecomendacion = "aprobada";
  if (recomendacion.regla === "E_consultar") estado = "bloqueada";
  else if (recomendacion.regla === "B_subir_peso" && config.requiereAutorizacion) estado = "propuesta";

  return {
    sesion_ejercicio_id: sesionEjercicioId,
    dia_ejercicio_id: diaEjercicioId,
    alumno_id: alumnoId,
    regla: recomendacion.regla,
    peso_sugerido_kg: recomendacion.pesoSugeridoKg,
    reps_objetivo_min: recomendacion.repsObjetivoMin,
    reps_objetivo_max: recomendacion.repsObjetivoMax,
    es_peso_corporal: recomendacion.esPesoCorporal,
    justificacion: recomendacion.justificacion,
    basado_en_sesion_ejercicio_id: ultima?.sesionEjercicioId ?? null,
    estado,
    motor_version: MOTOR_VERSION,
    decision_data: {
      objetivo,
      rangoOriginal: { min: rango.min, max: rango.max },
      seriesProgramadas,
      tipoProgresion: config.tipoProgresion,
      incrementoKg: config.incrementoKg,
      pesoAnteriorKg: ultima ? pesoMaximo(ultima.series) : null,
      repsAnterioresPorSerie: ultima ? ultima.series.map((s) => s.repsRealizadas) : [],
      totalAnteriorReps: ultima ? totalRepsRealizadas(ultima.series) : null,
      metaTotalReps: recomendacion.metaTotalReps,
      sesionesHistoricasValidas: historial.length,
      dificultadAnterior: ultima?.dificultadPercibida ?? null,
      esPesoCorporal: recomendacion.esPesoCorporal,
      motivos: recomendacion.motivos,
      alertaTipo: recomendacion.alertaTipo,
      basadoEnSesionEjercicioId: ultima?.sesionEjercicioId ?? null,
      basadoEnFecha: ultima?.fecha ?? null,
    },
  };
}

/** JSON plano no nulo y no-array — un objeto de verdad, no cualquier cosa
 * que `typeof x === 'object'` deje pasar (eso también es cierto para
 * arrays y para `null`). */
export function esObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Lee de `decision_data` los dos campos numéricos que hacen falta para
 * resolver el cumplimiento al guardar (`resolverCumplimiento` en motor.ts) —
 * nunca se asume la forma completa de `DecisionData`, solo se validan estos
 * dos campos puntuales. Si falta cualquiera, o `decisionData` no es un
 * objeto JSON válido, devuelve null en su lugar: a diferencia de
 * `leerAlertaTipo`, acá no hay nada que "deba" existir siempre (Reglas C/D/E
 * pueden no traer `metaTotalReps`), así que no corresponde lanzar.
 */
export function leerDatosCumplimiento(decisionData: unknown): {
  metaTotalReps: number | null;
  totalAnteriorReps: number | null;
} {
  if (!esObjetoJson(decisionData)) return { metaTotalReps: null, totalAnteriorReps: null };
  const meta = decisionData.metaTotalReps;
  const total = decisionData.totalAnteriorReps;
  return {
    metaTotalReps: typeof meta === "number" && Number.isFinite(meta) ? meta : null,
    totalAnteriorReps: typeof total === "number" && Number.isFinite(total) ? total : null,
  };
}

/**
 * Lee `alertaTipo` de un `decision_data` ya persistido — nunca se busca
 * dentro de `justificacion`, ni se castea `as any` fuera de acá.
 *
 * - Si `regla` no es `E_consultar`, devuelve null (no es un error: la
 *   inmensa mayoría de las recomendaciones no tienen alerta).
 * - Si es `E_consultar` y trae un `alertaTipo` válido, lo devuelve.
 * - Si es `E_consultar` y `decisionData` no es un objeto JSON válido, o le
 *   falta `alertaTipo`, o trae un valor que no es uno de los tres tipos
 *   conocidos: lanza. Es un dato corrupto (la Regla E siempre debería haber
 *   guardado su tipo) — mejor fallar fuerte que inventar un tipo de alerta
 *   o silenciar el problema.
 */
export function leerAlertaTipo(regla: ReglaImpulso, decisionData: unknown): AlertaTipo | null {
  if (regla !== "E_consultar") return null;
  if (!esObjetoJson(decisionData)) throw new Error(ERROR_ALERTA_TIPO_INVALIDO);

  const valor = decisionData.alertaTipo;
  if (valor !== "dolor" && valor !== "estancamiento_3_sesiones" && valor !== "caida_rendimiento") {
    throw new Error(ERROR_ALERTA_TIPO_INVALIDO);
  }
  return valor;
}

/** Arma el payload de alerta a partir de la fila persistida y un
 * `alertaTipo` YA validado (ver `leerAlertaTipo`) — pura asignación de
 * campos, sin volver a validar nada. Usa exclusivamente lo que quedó
 * guardado en la fila, nunca datos de una recomendación calculada en
 * memoria en la invocación actual. */
export function construirPayloadAlertaDesdeFila(fila: FilaRecomendacion, tipo: AlertaTipo): PayloadAlerta {
  return {
    alumno_id: fila.alumnoId,
    dia_ejercicio_id: fila.diaEjercicioId,
    sesion_ejercicio_id: fila.sesionEjercicioId,
    tipo,
  };
}

/**
 * Asegura que exista una alerta para `(payload.sesion_ejercicio_id,
 * payload.tipo)`, sin duplicar y sin reabrir una que ya esté resuelta: si ya
 * hay una fila (pendiente, vista o resuelta), se devuelve tal cual — nunca
 * se cambia su estado acá. El índice único parcial de la migración 0043
 * (`sesion_ejercicio_id, tipo`) es la red de seguridad real contra
 * duplicados concurrentes; esta función solo evita el viaje de más cuando
 * puede.
 */
export async function asegurarAlertaImpulso(repo: RepositorioAlertas, payload: PayloadAlerta): Promise<FilaAlerta> {
  let filaFinal = await repo.buscar(payload.sesion_ejercicio_id, payload.tipo);

  if (!filaFinal) {
    const resultado = await repo.insertar(payload);
    if (resultado.tipo === "insertada") {
      filaFinal = resultado.fila;
    } else {
      filaFinal = await repo.buscar(payload.sesion_ejercicio_id, payload.tipo);
      if (!filaFinal) throw new Error(ERROR_CONFLICTO_ALERTA);
    }
  }

  return filaFinal;
}

/** Compone el callback que espera `obtenerOCrearRecomendacion`: lee el tipo
 * de alerta de la fila YA persistida (nunca de un valor calculado en esta
 * invocación) y, si corresponde, asegura que exista. Para una recomendación
 * que no es Regla E, `leerAlertaTipo` devuelve null y ni `buscar` ni
 * `insertar` del repositorio de alertas se llegan a llamar. Depende
 * exclusivamente de `fila` — nunca recibe el payload local ni la
 * recomendación recién calculada. */
export function crearReparadorDeAlertas(
  repo: RepositorioAlertas
): (fila: FilaRecomendacion) => Promise<void> {
  return async (fila) => {
    const tipo = leerAlertaTipo(fila.regla, fila.decisionData);
    if (tipo === null) return;
    await asegurarAlertaImpulso(repo, construirPayloadAlertaDesdeFila(fila, tipo));
  };
}

/**
 * Inserta la recomendación, o recupera la que ganó una carrera de inserción
 * concurrente. NO busca una fila existente antes de intentar insertar — ese
 * chequeo es responsabilidad de quien llama (`generarYGuardarRecomendacion`
 * en data.ts hace esa búsqueda UNA sola vez, antes de siquiera calcular la
 * recomendación; duplicarla acá dejaría dos capas responsables de la misma
 * congelación). La única búsqueda que hace esta función es la de
 * recuperación tras un conflicto — sigue protegiendo la concurrencia igual:
 * si dos solicitudes llegan acá casi al mismo tiempo (ambas vieron "no
 * existe" en su búsqueda inicial en `data.ts`), una inserta con éxito y la
 * otra recibe `{ tipo: "conflicto" }` y recupera la fila de la primera.
 */
export async function insertarORecuperarRecomendacion(
  repo: RepositorioRecomendaciones,
  payload: PayloadRecomendacion,
  asegurarAlertaSiCorresponde: (fila: FilaRecomendacion) => Promise<void>
): Promise<FilaRecomendacion> {
  const resultado = await repo.insertar(payload);

  let filaFinal: FilaRecomendacion;
  if (resultado.tipo === "insertada") {
    filaFinal = resultado.fila;
  } else {
    const recuperada = await repo.buscar(payload.sesion_ejercicio_id);
    if (!recuperada) throw new Error(ERROR_CONFLICTO_RECOMENDACION);
    filaFinal = recuperada;
  }

  await asegurarAlertaSiCorresponde(filaFinal);
  return filaFinal;
}
