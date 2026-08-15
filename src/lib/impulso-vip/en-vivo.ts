import type { Recomendacion } from "./tipos";

export type TipoIntervencionEnVivo =
  | "cierre_controlado"
  | "repeticion_objetivo"
  | "tempo_controlado"
  | "pausa_isometrica"
  | "serie_descarga"
  | "drop_set"
  | "rest_pause"
  | "fallo_controlado";

export type ResultadoIntervencionEnVivo =
  | "lograda"
  | "parcial"
  | "no_lograda"
  | "omitida"
  | "omitida_molestia";

export interface IntervencionEnVivoCalculada {
  serieObjetivo: number;
  tipo: TipoIntervencionEnVivo;
  firma: "Metodo de Ale Mendoza";
  instruccion: string;
  motivo: string;
  prescripcion: Record<string, unknown>;
  decisionData: Record<string, unknown>;
}

export interface CalcularIntervencionEnVivoInput {
  seriesProgramadas: number;
  tecnicaProgramada: string | null;
  ejercicioVinculado: boolean;
  recomendacion: Pick<
    Recomendacion,
    "regla" | "pesoSugeridoKg" | "repsObjetivoMin" | "repsObjetivoMax" | "justificacion"
  > & { estado: "propuesta" | "aprobada" | "bloqueada" | "modificada" };
}

/**
 * Un alumno no debe recibir retos por cuota. La base es uno por sesión; el
 * segundo se gana con ejecuciones verificadas y consistentes. Dos mantiene el
 * efecto sorpresa y evita que Impulso se convierta en ruido diario.
 */
export const MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO = 2;
export const MIN_EJERCICIOS_CON_IMPULSO_EN_VIVO = 1;

export type EvidenciaImpulsoReciente = {
  resultado: ResultadoIntervencionEnVivo | null;
  verificacion: "datos" | "declarada" | "entrenador" | null;
};

/**
 * Determina cuántos retos automáticos puede recibir el alumno en esta sesión.
 * No usamos kilos absolutos: 25 kg puede ser excelente para una persona y
 * poco para otra. La señal justa es cumplir la prescripción que recibió y
 * dejar datos completos. Cuatro retos seguidos logrados y verificados indican
 * que puede asumir un segundo desafío sin convertirlo en castigo.
 */
export function resolverCupoImpulsoSesion(
  historial: readonly EvidenciaImpulsoReciente[]
): number {
  const ventana = historial.slice(0, 4);
  const preparadoParaSegundoReto = ventana.length === 4 && ventana.every(
    (reto) => reto.resultado === "lograda" && reto.verificacion === "datos"
  );
  return preparadoParaSegundoReto
    ? MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO
    : MIN_EJERCICIOS_CON_IMPULSO_EN_VIVO;
}

export function calcularIntervencionesEnVivo(
  input: CalcularIntervencionEnVivoInput
): IntervencionEnVivoCalculada[] {
  const cierre = calcularIntervencionEnVivo(input);
  if (!cierre) return [];

  // En ejercicios largos, Ale aparece una vez antes del cierre para ordenar
  // el esfuerzo. No requiere encuesta: es direccion, no un segundo reto.
  if (input.seriesProgramadas >= 5) {
    return [
      {
        serieObjetivo: 3,
        tipo: "tempo_controlado",
        firma: "Metodo de Ale Mendoza",
        instruccion:
          "No gastes todo todavia. Mantén el recorrido completo y controla la bajada; la última serie será la que vamos a exigir.",
        motivo: "Ordena el esfuerzo a mitad de un ejercicio largo sin agregar fatiga ni interrumpir cada serie.",
        prescripcion: { orientacion: true, requiereResultado: false },
        decisionData: { clase: "orientacion", tecnicaDinamicaIntensaPermitida: false },
      },
      cierre,
    ];
  }

  return [cierre];
}

/**
 * Primera version deliberadamente conservadora de Impulso En Vivo.
 *
 * Crea como maximo un momento, en la ultima serie, y no agrega todavia una
 * tecnica intensiva que no estuviera programada. Con esto se prueba el ciclo
 * mostrar -> ejecutar -> registrar -> recordar antes de habilitar drop set,
 * rest-pause o fallo dinamicos.
 */
export function calcularIntervencionEnVivo(
  input: CalcularIntervencionEnVivoInput
): IntervencionEnVivoCalculada | null {
  const { recomendacion } = input;
  if (input.seriesProgramadas < 3) return null;
  if (recomendacion.estado !== "aprobada" && recomendacion.estado !== "modificada") return null;
  if (recomendacion.regla === "E_consultar" || recomendacion.regla === "D_reducir") return null;
  // Una tecnica ya programada manda. No se apilan estimulos automaticamente.
  if (input.tecnicaProgramada?.trim()) return null;

  const serieObjetivo = input.seriesProgramadas;
  const reps = recomendacion.repsObjetivoMax ?? recomendacion.repsObjetivoMin;
  const peso = recomendacion.pesoSugeridoKg;
  const objetivo = [peso !== null ? `${peso} kg` : null, reps !== null ? `${reps} repeticiones` : null]
    .filter(Boolean)
    .join(" y ");

  return {
    serieObjetivo,
    tipo: "cierre_controlado",
    firma: "Metodo de Ale Mendoza",
    instruccion: objetivo
      ? `Esta es la serie que cuenta: busca ${objetivo} con recorrido completo. Si la tecnica se rompe, detente; una repeticion limpia vale mas que una forzada.`
      : "Esta es la serie que cuenta: supera tu ejecucion anterior sin perder recorrido ni control.",
    motivo: "La ultima serie concentra el desafio del dia sin agregar volumen ni una tecnica intensa no autorizada.",
    prescripcion: {
      pesoKg: peso,
      repsObjetivo: reps,
      repsObjetivoMin: recomendacion.repsObjetivoMin,
      repsObjetivoMax: recomendacion.repsObjetivoMax,
      detenerSiPierdeTecnica: true,
    },
    decisionData: {
      reglaBase: recomendacion.regla,
      ejercicioVinculado: input.ejercicioVinculado,
      tecnicaDinamicaIntensaPermitida: false,
    },
  };
}

export interface EjercicioCandidatoDestacado {
  categoria: string;
  posicionSesion: string | null;
  grupoMuscular: string | null;
}

/**
 * Puntaje de "mejor candidato" para elegir los ejercicios destacados de la
 * sesion. Compuestos (posicion principal, o empuje/traccion/pierna/full_body
 * como ya define el generador de rutinas en motor.ts) y el grupo muscular
 * mas repetido del dia suman; nunca el orden en que el alumno llega a cada
 * ejercicio (HANDOFF 1.26, brecha 3 — Alejandro pidio priorizar esto).
 */
export function puntajeCandidatoDestacado(
  ejercicio: EjercicioCandidatoDestacado,
  grupoPrioritarioDia: string | null
): number {
  const esCompuesto =
    ejercicio.posicionSesion === "principal"
    || ["empuje", "traccion", "pierna", "full_body"].includes(ejercicio.categoria);
  const esGrupoPrioritario = grupoPrioritarioDia !== null && ejercicio.grupoMuscular === grupoPrioritarioDia;
  return (esCompuesto ? 2 : 0) + (esGrupoPrioritario ? 1 : 0);
}

/**
 * Grupo muscular mas repetido entre los ejercicios de la sesion: proxy del
 * "foco del dia" sin depender de un campo nuevo en rutina_dias. Un empate lo
 * gana el primero en aparecer, así que conviene pasar los grupos en orden de
 * rutina para que el resultado sea estable.
 */
export function grupoMuscularPrioritarioDia(gruposMusculares: Array<string | null>): string | null {
  const conteo = new Map<string, number>();
  for (const grupo of gruposMusculares) {
    if (grupo === null) continue;
    conteo.set(grupo, (conteo.get(grupo) ?? 0) + 1);
  }
  let mejor: string | null = null;
  let maximo = 0;
  for (const grupo of gruposMusculares) {
    if (grupo === null) continue;
    const cuenta = conteo.get(grupo) ?? 0;
    if (cuenta > maximo) {
      maximo = cuenta;
      mejor = grupo;
    }
  }
  return mejor;
}

export function calibrarCierreControlado(
  instruccionBase: string,
  prescripcionBase: Record<string, unknown>,
  rir: number
): { instruccion: string; prescripcion: Record<string, unknown> } {
  const rirSeguro = Math.max(0, Math.min(5, Math.round(rir)));
  const min = typeof prescripcionBase.repsObjetivoMin === "number"
    ? prescripcionBase.repsObjetivoMin
    : null;
  const max = typeof prescripcionBase.repsObjetivoMax === "number"
    ? prescripcionBase.repsObjetivoMax
    : typeof prescripcionBase.repsObjetivo === "number"
      ? prescripcionBase.repsObjetivo
      : null;

  if (rirSeguro === 0) {
    return {
      instruccion: min !== null
        ? `Llegaste al limite en la serie anterior. En esta ultima busca ${min} repeticiones limpias y detente si pierdes recorrido. Hoy no necesito una repeticion forzada.`
        : "Llegaste al limite en la serie anterior. Repite una serie limpia y detente antes de perder recorrido; hoy no necesito una repeticion forzada.",
      prescripcion: { ...prescripcionBase, repsObjetivo: min, rirCalibracion: rirSeguro },
    };
  }

  if (rirSeguro === 1) {
    return {
      instruccion: `${instruccionBase} Te quedaba una: quiero intensidad, pero ninguna repeticion rota.`,
      prescripcion: { ...prescripcionBase, repsObjetivo: max, rirCalibracion: rirSeguro },
    };
  }

  return {
    instruccion: max !== null
      ? `Todavia tienes margen. Esta es la serie que cuenta: alcanza ${max} repeticiones limpias y, solo si mantienes el recorrido, pelea una mas.`
      : "Todavia tienes margen. Esta es la serie que cuenta: supera tu marca y pelea una repeticion mas solamente si sigue limpia.",
    prescripcion: { ...prescripcionBase, repsObjetivo: max, rirCalibracion: rirSeguro },
  };
}
