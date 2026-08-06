/**
 * Umbrales y funciones puras de detección para la Auditoría de Puntos VIP.
 * Separado de la consulta a Supabase (ver `data.ts`) para poder testear los
 * límites sin pegarle a la base — ver `deteccion.test.ts`.
 */

export const UMBRAL_DURACION_IMPOSIBLE = {
  minimoSeries: 6,
  segundosMinimosPorSerie: 15,
} as const;

/**
 * true si la duración total de la sesión es físicamente insuficiente para la
 * cantidad de series que dice haber completado — ni ejecutarlas ni siquiera
 * cargarlas a mano entra en ese tiempo.
 */
export function esDuracionImposible(duracionSegundos: number, totalSeries: number): boolean {
  if (totalSeries < UMBRAL_DURACION_IMPOSIBLE.minimoSeries) return false;
  return duracionSegundos < totalSeries * UMBRAL_DURACION_IMPOSIBLE.segundosMinimosPorSerie;
}
