/**
 * Técnica aplicada a series puntuales en vez de a todo el ejercicio.
 *
 * Hasta la migración `0073_tecnica_por_serie.sql`, poner "Drop set" en un
 * ejercicio significaba drop set en TODAS las series. En la práctica casi
 * siempre va en una sola —la última— o en dos. `tecnica_series` guarda cuáles.
 *
 * La regla que atraviesa todo este módulo: **`null` significa "todas las
 * series"**, no "ninguna". Es lo que tienen todas las filas anteriores a la
 * migración, así que cualquier función de acá tiene que devolver, con `null`,
 * exactamente lo que devolvía antes de que esto existiera.
 */

/** Un array vacío significaría "en ninguna serie", que es lo mismo que no
 * tener técnica. Se guarda `null` y no `[]` para que haya una sola forma de
 * decir cada cosa — el CHECK de la migración también rechaza `'{}'`. */
export function normalizarTecnicaSeries(
  series: readonly number[] | null | undefined,
  seriesProgramadas: number
): number[] | null {
  if (!series) return null;
  const limpias = Array.from(new Set(series))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= seriesProgramadas)
    .sort((a, b) => a - b);
  if (limpias.length === 0) return null;
  // Marcarlas todas es lo mismo que no marcar ninguna: la técnica va en el
  // ejercicio entero, que es justo lo que representa `null`. Guardar
  // `[1,2,3,4]` funcionaría igual, pero dejaría dos formas de decir lo mismo
  // y obligaría a cada lector a comparar contra `seriesProgramadas`.
  if (limpias.length === seriesProgramadas) return null;
  return limpias;
}

/** ¿La técnica del ejercicio corre en esta serie? Con `null` corre en todas,
 * que es el comportamiento de siempre. */
export function tecnicaAplicaASerie(
  tecnicaSeries: readonly number[] | null | undefined,
  numeroSerie: number
): boolean {
  if (!tecnicaSeries || tecnicaSeries.length === 0) return true;
  return tecnicaSeries.includes(numeroSerie);
}

/** Texto corto para el editor y para la tarjeta del alumno: "todas las
 * series", "última serie", "serie 2", "series 2 y 4". */
export function etiquetaSeriesTecnica(
  tecnicaSeries: readonly number[] | null | undefined,
  seriesProgramadas: number
): string {
  const series = normalizarTecnicaSeries(tecnicaSeries, seriesProgramadas);
  if (!series) return "todas las series";
  if (series.length === 1) {
    return series[0] === seriesProgramadas ? "última serie" : `serie ${series[0]}`;
  }
  if (series.length === 2) return `series ${series[0]} y ${series[1]}`;
  return `series ${series.slice(0, -1).join(", ")} y ${series[series.length - 1]}`;
}

/**
 * Qué series sirven para calcular la progresión de Impulso VIP, o `null` si el
 * ejercicio hay que excluirlo entero (que es lo que se hacía siempre).
 *
 * Regla aprobada por Alejandro el 12/08 (ver HANDOFF 1.20):
 *
 * 1. Las series con técnica se ignoran — no cuentan como cero, se descartan.
 *    Mismo criterio que ya usa el motor con las series sin peso cargado
 *    (`motor.ts`, HANDOFF 1.9): no castigar por un dato que falta en lugar de
 *    por rendimiento real.
 * 2. Las limpias sirven **solo si están todas antes de la primera con
 *    técnica**. Este es el punto que no es obvio: un drop set en la última
 *    serie no contamina nada, porque las anteriores se hicieron frescas; pero
 *    una técnica en la serie 1 o 2 deja a las siguientes con una fatiga que no
 *    es la de una serie normal, y comparar eso contra el historial sería
 *    exactamente el error que la exclusión existe para evitar.
 * 3. Con menos de 2 series limpias se excluye igual: una sola serie es ruido,
 *    no una tendencia.
 *
 * Las técnicas encadenadas (superserie, biserie, circuito, giant set) siguen
 * excluidas enteras sin excepción, y eso se cumple solo: en ellas
 * `tecnicaSeries` es siempre `null` y esta función devuelve `null`.
 */
export const MIN_SERIES_LIMPIAS = 2;

export function seriesLimpiasParaProgresion(
  tecnicaSeries: readonly number[] | null | undefined,
  seriesProgramadas: number
): number[] | null {
  const conTecnica = normalizarTecnicaSeries(tecnicaSeries, seriesProgramadas);
  // `null` = la técnica cubre el ejercicio entero. No queda nada limpio.
  if (!conTecnica) return null;

  const primeraConTecnica = conTecnica[0];
  const limpias: number[] = [];
  for (let n = 1; n <= seriesProgramadas; n += 1) {
    if (conTecnica.includes(n)) continue;
    // Punto 2: una serie limpia que viene DESPUÉS de una con técnica arrastra
    // la fatiga de esa técnica. Basta con que exista una para tirar el
    // ejercicio entero — no se puede saber cuánto la afectó.
    if (n > primeraConTecnica) return null;
    limpias.push(n);
  }

  return limpias.length >= MIN_SERIES_LIMPIAS ? limpias : null;
}
