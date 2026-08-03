/**
 * Ancla del descanso entre series: no un contador que cuenta hacia atrás
 * (eso se pierde apenas se desmonta el componente), sino la marca de tiempo
 * real en que termina, guardada en el teléfono.
 *
 * Cambiar de pestaña (Nutrición, Progreso, Ranking...) desmonta por completo
 * la pantalla de la sesión — es una ruta distinta — y con ella cualquier
 * `useState` que llevara la cuenta. Con la hora de fin guardada acá, al
 * volver a Entrenar se recalcula cuánto falta contra el reloj real del
 * teléfono en vez de arrancar de cero o quedar congelado.
 *
 * Mismo criterio que `borrador.ts`: por alumno/sesión/ejercicio/serie, con
 * vencimiento para no restaurar descansos de hace días.
 */

const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

function clave(sesionId: string, sesionEjercicioId: string, numeroSerie: number): string {
  return `vip:descanso:${sesionId}:${sesionEjercicioId}:${numeroSerie}`;
}

/** `finEn`: `Date.now()` + segundos de descanso, en milisegundos. */
export function guardarDescanso(
  sesionId: string,
  sesionEjercicioId: string,
  numeroSerie: number,
  finEn: number
): void {
  try {
    localStorage.setItem(clave(sesionId, sesionEjercicioId, numeroSerie), String(finEn));
  } catch {
    // Modo privado o almacenamiento lleno: el descanso sigue corriendo en
    // memoria mientras la pantalla no se desmonte, solo no sobrevive a un
    // cambio de pestaña. No es motivo para romper nada.
  }
}

/** `null` si no hay descanso pendiente o si ya venció (más de un día). */
export function leerDescanso(
  sesionId: string,
  sesionEjercicioId: string,
  numeroSerie: number
): number | null {
  try {
    const crudo = localStorage.getItem(clave(sesionId, sesionEjercicioId, numeroSerie));
    if (!crudo) return null;
    const finEn = Number(crudo);
    if (!Number.isFinite(finEn)) return null;
    if (Date.now() - finEn > VENCIMIENTO_MS) {
      limpiarDescanso(sesionId, sesionEjercicioId, numeroSerie);
      return null;
    }
    return finEn;
  } catch {
    return null;
  }
}

export function limpiarDescanso(
  sesionId: string,
  sesionEjercicioId: string,
  numeroSerie: number
): void {
  try {
    localStorage.removeItem(clave(sesionId, sesionEjercicioId, numeroSerie));
  } catch {
    // Ver guardarDescanso.
  }
}
