/**
 * Último alumno elegido por el entrenador en las herramientas de rutina —
 * Armar rutina, Generador, Rutinas hechas, Documentos. Cada una ya tiene su
 * propio guardado de borrador (`asistente-armado-local.ts`, `borrador-
 * local.ts`), pero ninguna sabía del alumno elegido en las OTRAS: cambiar de
 * Armar rutina a Documentos para subirle un PDF a la misma persona obligaba
 * a buscarla de nuevo (sección 9.1 del instructivo de reorganización del
 * panel: "el alumno seleccionado persiste al cambiar entre Armar, Generar,
 * Rutinas hechas y Documentos").
 *
 * Una sola clave compartida entre las cuatro pantallas, a propósito: es el
 * mismo entrenador trabajando con el mismo alumno un momento después, no
 * cuatro contextos distintos.
 */

const CLAVE = "vip:ultimo-alumno-elegido";
const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

export function guardarUltimoAlumnoElegido(alumnoId: string): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ alumnoId, guardadoEn: Date.now() }));
  } catch {
    // Modo privado o almacenamiento lleno: la selección manual sigue
    // funcionando igual, esto es solo un atajo.
  }
}

export function leerUltimoAlumnoElegido(): string | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as { alumnoId: string; guardadoEn: number };
    if (!dato?.alumnoId) return null;
    if (Date.now() - (dato.guardadoEn ?? 0) > VENCIMIENTO_MS) return null;
    return dato.alumnoId;
  } catch {
    return null;
  }
}
