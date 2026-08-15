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

/**
 * ¿Hay algún descanso de esta sesión que ya se pasó de hora?
 *
 * Sirve para decirle la verdad al alumno cuando vuelve de otra app: si tenía
 * un descanso corriendo, siguió corriendo sin él y el contador de exceso está
 * descontando puntos. Se recorre `localStorage` porque el descanso está
 * guardado por serie y acá no se sabe cuál estaba activa — son unas pocas
 * claves por sesión, no vale la pena un índice aparte.
 */
export function hayDescansoVencido(sesionId: string): boolean {
  try {
    const prefijo = `vip:descanso:${sesionId}:`;
    const ahora = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefijo)) continue;
      const finEn = Number(localStorage.getItem(k));
      if (Number.isFinite(finEn) && finEn <= ahora) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ¿Un descanso que quedó PAUSADO —otra serie tomó el turno— ya cumplió su
 * tiempo?
 *
 * Pura y con `ahora` inyectable para poder probarla. La usa el efecto de
 * `FilaSerie` que cierra el ciclo de una serie cuyo descanso dejó de mirarse:
 * el contador visible solo corre para la fila activa, así que una fila pausada
 * necesita resolverse contra la hora real de fin y no contra un contador
 * propio que ya no tickea.
 *
 * `finEn === null` cuenta como terminado: si no hay hora de fin guardada no
 * queda nada que esperar, y dejar la serie pendiente para siempre es
 * exactamente el bug que rompía las biseries (ver el comentario del efecto).
 */
export function descansoPausadoTermino(finEn: number | null, ahora: number = Date.now()): boolean {
  return finEn === null || ahora >= finEn;
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
