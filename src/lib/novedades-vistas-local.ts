/**
 * Qué tan al día está el entrenador con el registro de novedades
 * (`registro_cambios`, ver `lib/novedades.ts`).
 *
 * Pedido explícito: "una nueva sección con el registro de actualizaciones, y
 * cuando llega una nueva que se me notifique". El registro ya existía pero
 * estaba enterrado en una gaveta de Configuración sin ninguna forma de saber
 * si había algo nuevo sin leer. Este módulo guarda LOCALMENTE (no hay
 * entrenador con sesión en dos dispositivos en este gimnasio) la fecha de la
 * última novedad que se vio, para poder mostrar un contador de "sin ver" en
 * la navegación — mismo espíritu que `borrador-local.ts` y compañía, pero acá
 * es un cursor de lectura, no un borrador.
 */

const CLAVE = "vip:novedades-vistas-hasta";

/** ISO de la última novedad que el entrenador ya vio, o `null` si nunca vio ninguna. */
export function leerNovedadesVistasHasta(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function marcarNovedadesVistasHasta(fechaISO: string): void {
  try {
    localStorage.setItem(CLAVE, fechaISO);
  } catch {
    // Modo privado o almacenamiento lleno: el contador puede repetirse en la
    // próxima carga, pero no rompe nada.
  }
}

/** Cuántas de estas fechas son más nuevas que lo último visto. */
export function contarNovedadesSinVer(fechasISO: string[]): number {
  const vistaHasta = leerNovedadesVistasHasta();
  if (!vistaHasta) return fechasISO.length;
  return fechasISO.filter((fecha) => fecha > vistaHasta).length;
}
