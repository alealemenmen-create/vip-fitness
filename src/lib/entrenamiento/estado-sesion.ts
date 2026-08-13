/**
 * Qué sesiones se pueden corregir, en un solo lugar.
 *
 * Existía el mismo criterio escrito dos veces y no decían lo mismo: la
 * pantalla dibujaba "Corregir registro" con `estado !== 'en_progreso'`
 * (o sea, también en las **abandonadas**) mientras `reabrirSesion` solo
 * aceptaba `completada` y `finalizada_incompleta` y, si no, volvía en
 * silencio. Resultado: en una sesión abandonada el botón aparecía, el alumno
 * confirmaba "Sí, corregir" y no pasaba absolutamente nada. Reportado por
 * Alejandro: "ese botón está pegado".
 *
 * Un botón que no hace nada es peor que un botón que no está: el alumno lo
 * toca de nuevo, piensa que la app se colgó y abandona la pantalla. Ahora las
 * dos puntas leen de acá.
 *
 * Las abandonadas quedan afuera a propósito, no por olvido: abandonar retira
 * los puntos que la sesión había sumado y la cierra como constancia de que se
 * empezó (ver `abandonarSesion`). Volver a abrirlas para editar sería
 * deshacer esa decisión por la puerta de atrás.
 */
export const ESTADOS_CORREGIBLES = ["completada", "finalizada_incompleta"] as const;

export type EstadoCorregible = (typeof ESTADOS_CORREGIBLES)[number];

export function sePuedeCorregir(estado: string | null | undefined): estado is EstadoCorregible {
  return typeof estado === "string" && (ESTADOS_CORREGIBLES as readonly string[]).includes(estado);
}
