/**
 * Respaldo local del ASISTENTE de "Armar rutina" (selección de alumno, nivel,
 * estructura semanal) — el tramo ANTES de llegar a la mesa de trabajo.
 *
 * Reportado por el entrenador: si a mitad del asistente (elegir alumno,
 * elegir nivel, diseñar la estructura semanal) se va a otra pestaña —
 * Documentos, Alimentos, Alumnos, cualquier otra— y vuelve, todo se borra y
 * hay que empezar de nuevo. La causa es que `ArmarRutinaPanel` es un árbol de
 * componentes cliente sin persistencia propia: Next.js lo desmonta al cambiar
 * de ruta y el estado de React se pierde con él.
 *
 * `borrador-local.ts` ya resuelve esto para la mesa de trabajo (una vez
 * elegidos los ejercicios), pero esa pantalla ni siquiera llega a montarse si
 * `ArmarRutinaPanel` se remonta con `rutina = null`: hay que volver a elegir
 * alumno y estructura para volver a verla. Este módulo guarda TODO el
 * asistente (steps 1 a 4) para que retomar sea automático, sin preguntar —
 * a diferencia del borrador de la mesa de trabajo, acá no hay ambigüedad de
 * "¿esto es lo que estaba armando o algo nuevo?": es la misma pantalla, el
 * mismo entrenador, solo que cambió de pestaña un momento.
 *
 * Una sola clave (no por alumno): el entrenador arma una rutina a la vez con
 * esta herramienta, y antes de elegir alumno todavía no hay id para usar como
 * clave.
 */

const CLAVE = "vip:asistente-armado";

/** Un asistente de más de un día es de una sesión de trabajo que ya terminó
 * de otra forma (se armó desde otro dispositivo, se resolvió por otra vía):
 * seguir ofreciéndolo confunde más de lo que ayuda. Más corto que los 3 días
 * del borrador de la mesa de trabajo porque acá no hay "Retomarla" que
 * preguntar — se restaura solo, así que conviene ser más conservador. */
const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

export function guardarAsistenteArmado<T>(estado: T): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ estado, guardadoEn: Date.now() }));
  } catch {
    // Modo privado o almacenamiento lleno: el asistente sigue igual, esto es
    // solo la red de seguridad.
  }
}

export function leerAsistenteArmado<T>(): T | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as { estado: T; guardadoEn: number };
    if (!dato || dato.estado === undefined) return null;
    if (Date.now() - (dato.guardadoEn ?? 0) > VENCIMIENTO_MS) {
      limpiarAsistenteArmado();
      return null;
    }
    return dato.estado;
  } catch {
    return null;
  }
}

export function limpiarAsistenteArmado(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Ver guardarAsistenteArmado.
  }
}
