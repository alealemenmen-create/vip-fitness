import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/**
 * De qué imagen se muestra al lado de cada ejercicio.
 *
 * La ilustración es un archivo estático en `public/ejercicios/<slug>.svg`, no
 * se genera al vuelo ni se guarda en la base: se resuelve por nombre y el
 * navegador la cachea como cualquier otro recurso.
 *
 * Cadena de respaldo, en orden:
 *   1. La ilustración del ejercicio (una persona haciendo el movimiento).
 *   2. La foto del grupo muscular, que es lo que la app muestra hoy.
 *   3. Nada — el componente decide qué poner en su lugar.
 *
 * El respaldo existe para que la biblioteca pueda entrar en producción **antes**
 * de tener las 59 ilustraciones dibujadas: cada archivo que se agregue a
 * `public/ejercicios/` empieza a aparecer solo, sin tocar código ni base.
 */

export type OrigenIlustracion = "ilustracion" | "foto-grupo" | "ninguno";

export type Ilustracion = {
  src: string | null;
  origen: OrigenIlustracion;
};

/** Los `ilustracion_slug` que ya tienen archivo dibujado en public/ejercicios.
 *
 * Se lleva a mano a propósito: en el servidor no se puede preguntar por la
 * existencia de un archivo sin tocar disco en cada render, y en el navegador
 * un <img> roto ya habría hecho parpadear el hueco. Al agregar un SVG nuevo,
 * sumar su nombre acá. */
const ILUSTRACIONES_DISPONIBLES = new Set<string>([
  // Vacío por ahora: todavía no hay ilustraciones dibujadas, así que todo cae
  // a la foto de grupo muscular. Ver HANDOFF — falta comprar o encargar el set.
]);

export function resolverIlustracion(
  ilustracionSlug: string | null | undefined,
  grupoMuscular: GrupoMuscular | null | undefined
): Ilustracion {
  if (ilustracionSlug && ILUSTRACIONES_DISPONIBLES.has(ilustracionSlug)) {
    return { src: `/ejercicios/${ilustracionSlug}.svg`, origen: "ilustracion" };
  }

  const fotos = grupoMuscular ? FOTOS_GRUPO_MUSCULAR[grupoMuscular] : undefined;
  if (fotos && fotos.length > 0) {
    return { src: fotos[0], origen: "foto-grupo" };
  }

  return { src: null, origen: "ninguno" };
}

/** Cuántas ilustraciones faltan dibujar, para poder mostrarlo en el panel del
 * entrenador sin tener que contar a mano. */
export function ilustracionesDisponibles(): number {
  return ILUSTRACIONES_DISPONIBLES.size;
}
