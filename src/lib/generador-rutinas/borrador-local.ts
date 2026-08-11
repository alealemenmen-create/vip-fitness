/**
 * Respaldo local de la rutina que el entrenador está armando.
 *
 * Pedido explícito, primero en su lista de importantes: "guardar el progreso
 * al armar". Una rutina de 5 días son 25-30 ejercicios elegidos de a uno, y
 * hasta ahora todo eso vivía únicamente en el estado de React: cerrar la
 * pestaña, recargar sin querer o que el teléfono descartara la página por
 * memoria borraba el trabajo entero. El borrador del servidor
 * (`borradores_generador_rutinas`) solo guarda lo que salió del motor, no lo
 * que el entrenador editó encima.
 *
 * Es lo mismo que ya hace `lib/entrenamiento/borrador.ts` para el alumno en
 * medio de una sesión, con la misma regla de precedencia: el borrador existe
 * solo mientras hay trabajo sin publicar. Al publicar se borra, así que al
 * volver a entrar solo aparece si de verdad quedó algo a medias.
 *
 * No reemplaza a la publicación ni a la base: es una red de seguridad del
 * navegador. Nada de esto viaja al servidor.
 */

export type BorradorArmado<T = unknown> = {
  rutina: T;
  /** Marca de tiempo, para poder mostrar "de hace 10 minutos" y descartar lo viejo. */
  guardadoEn: number;
  /** Para no ofrecerle el borrador de un alumno mientras arma el de otro. */
  alumnoIds: string[];
  /** Cuántos ejercicios tenía, para poder decirlo sin abrirlo. */
  ejercicios: number;
};

/** Un borrador de hace más de tres días es de una rutina que ya se resolvió
 * de otra forma: ofrecerlo confunde más de lo que ayuda. */
const VENCIMIENTO_MS = 3 * 24 * 60 * 60 * 1000;

/** Ordenados: el mismo grupo de alumnos tiene que dar la misma clave sin
 * importar en qué orden los haya marcado. */
function clave(alumnoIds: string[]): string {
  return `vip:armado:${[...alumnoIds].sort().join(",")}`;
}

export function guardarBorradorArmado<T>(alumnoIds: string[], rutina: T, ejercicios: number): void {
  if (alumnoIds.length === 0) return;
  try {
    const dato: BorradorArmado<T> = { rutina, guardadoEn: Date.now(), alumnoIds, ejercicios };
    localStorage.setItem(clave(alumnoIds), JSON.stringify(dato));
  } catch {
    // Modo privado o almacenamiento lleno. El armado sigue igual: esto es
    // solo la red de seguridad.
  }
}

export function leerBorradorArmado<T>(alumnoIds: string[]): BorradorArmado<T> | null {
  if (alumnoIds.length === 0) return null;
  try {
    const crudo = localStorage.getItem(clave(alumnoIds));
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as BorradorArmado<T>;
    if (!dato || !dato.rutina) return null;
    if (Date.now() - (dato.guardadoEn ?? 0) > VENCIMIENTO_MS) {
      limpiarBorradorArmado(alumnoIds);
      return null;
    }
    return dato;
  } catch {
    return null;
  }
}

export function limpiarBorradorArmado(alumnoIds: string[]): void {
  if (alumnoIds.length === 0) return;
  try {
    localStorage.removeItem(clave(alumnoIds));
  } catch {
    // Ver guardarBorradorArmado.
  }
}

/** "hace 3 minutos", "hace 2 horas", "el 09/08". Para que el aviso de
 * recuperación diga de cuándo es sin obligar a abrirlo. */
export function haceCuanto(guardadoEn: number, ahora = Date.now()): string {
  const minutos = Math.floor((ahora - guardadoEn) / 60_000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
