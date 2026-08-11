/**
 * Cuál de las sesiones de la rutina activa es "la de hoy" para el botón
 * Continuar de Inicio.
 *
 * Vive aparte de `app/alumno/inicio/data.ts` (que es `server-only`) para
 * poder probarlo sin base de datos: la regla es de negocio, no de consulta.
 *
 * Reportado por el entrenador con un alumno real: estaba ejecutando la sesión
 * 6, volvió a Inicio, tocó "Continuar" y lo mandó a la 7. La causa es que
 * Inicio tomaba la sesión de mayor `numero_calendario`, y una fila creada por
 * "Ver entrenamiento" ya existe en `en_progreso` aunque nunca se haya tocado
 * "Iniciar rutina" (ver `obtenerSesionEnProgreso` en entrenar/data.ts, que
 * usa este mismo criterio más estricto). Pedido textual: "siempre tiene que
 * estar sobrepuesta la rutina que se está ejecutando".
 */

export type SesionCandidata = {
  id: string;
  fecha: string;
  estado: string;
  rutina_iniciada_en?: string | null;
  rutina_dias?: unknown;
};

/** Un día de descanso no tiene el segundo paso de "Iniciar rutina": se
 * registra directo, así que cuenta como en curso con solo existir. */
function estaEjecutandose(sesion: SesionCandidata): boolean {
  if (sesion.estado !== "en_progreso") return false;
  const dia = sesion.rutina_dias as { tipo?: string } | null | undefined;
  return dia?.tipo === "descanso" || sesion.rutina_iniciada_en != null;
}

/**
 * `sesiones` viene ordenada por `numero_calendario` descendente.
 *
 * Prioridad:
 * 1. La que se está ejecutando de verdad (aunque haya otra con número mayor).
 * 2. La más reciente, si sigue en progreso o se hizo hoy — el comportamiento
 *    de antes, que cubre la vista previa recién creada y la sesión ya
 *    terminada hoy ("Ver entrenamiento").
 */
export function elegirSesionDeHoy<T extends SesionCandidata>(
  sesiones: T[],
  hoyISO: string
): T | null {
  const ejecutandose = sesiones.filter(estaEjecutandose);
  if (ejecutandose.length > 0) {
    // Si por algún motivo hubiera más de una arrancada, gana la de número más
    // bajo: es la que quedó atrás en la rotación y hay que terminar primero.
    return ejecutandose[ejecutandose.length - 1];
  }

  const ultima = sesiones[0];
  if (!ultima) return null;
  if (ultima.estado !== "en_progreso" && ultima.fecha !== hoyISO) return null;
  return ultima;
}
