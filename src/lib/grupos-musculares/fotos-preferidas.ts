import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/**
 * Ejercicios curados a mano como "mejor foto" por grupo muscular para la
 * portada del día en Entrenamiento (ver `fotoPortadaDia`) -- fotos reales
 * tomadas en el gimnasio VIP, elegidas por encuadre/luz/claridad del
 * movimiento, no "la primera que aparezca en la rutina de ese día". Hasta 2
 * por grupo, en orden de preferencia (`ilustracion_slug`, ver
 * `public/ejercicios-completas/<slug>.webp`). Si el día no trae ninguno de
 * estos ejercicios, `fotoPortadaDia` cae a la primera foto disponible.
 *
 * Revisadas a mano por Claude, 2026-08-21, a pedido de Alejandro ("elegí las
 * mejores fotos, que se vean mejor").
 */
export const FOTOS_PREFERIDAS_POR_GRUPO: Partial<Record<GrupoMuscular, string[]>> = {
  pecho: ["press-banca", "press-inclinado"],
  espalda: ["remo-barra", "jalon-pecho"],
  piernas: ["sentadilla", "prensa"],
  hombros: ["press-hombro-mancuernas", "elevaciones-laterales"],
  brazos: ["curl-barra", "triceps-polea"],
  core: ["plancha", "rueda-abdominal"],
  cardio: ["bicicleta"],
};
