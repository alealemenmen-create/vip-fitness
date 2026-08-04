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
 * de tener las 70 ilustraciones dibujadas: cada archivo que se agregue a
 * `public/ejercicios/` empieza a aparecer solo, sin tocar código ni base.
 */

export type OrigenIlustracion = "ilustracion" | "foto-grupo" | "ninguno";

export type Ilustracion = {
  src: string | null;
  origen: OrigenIlustracion;
};

/** Los `ilustracion_slug` que ya tienen archivo en public/ejercicios, con su
 * extensión.
 *
 * Se lleva a mano a propósito: en el servidor no se puede preguntar por la
 * existencia de un archivo sin tocar disco en cada render, y en el navegador
 * un <img> roto ya habría hecho parpadear el hueco.
 *
 * La extensión es parte del dato porque van a convivir varios orígenes: las
 * fotos tomadas en el gimnasio VIP van en .webp (o .jpg) y un set dibujado
 * vendría en .svg o .png con fondo transparente. */
const ILUSTRACIONES_DISPONIBLES = new Map<string, "webp" | "jpg" | "png" | "svg">([
  // Fotos reales tomadas en el gimnasio VIP, procesadas (brillo/contraste
  // ajustado, recortadas a public/ejercicios/<slug>.webp).
  ['aductores', 'webp'],
  ['aperturas', 'webp'],
  ['aperturas-inclinado', 'webp'],
  ['aperturas-polea', 'webp'],
  ['belt-squat', 'webp'],
  ['bicicleta', 'webp'],
  ['buenos-dias', 'webp'],
  ['bulgara', 'webp'],
  ['burpees', 'webp'],
  ['crunch', 'webp'],
  ['crunch-maquina', 'webp'],
  ['crunch-polea', 'webp'],
  ['curl-barra', 'webp'],
  ['curl-concentrado', 'webp'],
  ['curl-femoral', 'webp'],
  ['curl-femoral-pie', 'webp'],
  ['curl-femoral-sentado', 'webp'],
  ['curl-inclinado', 'webp'],
  ['curl-mancuernas', 'webp'],
  ['curl-martillo', 'webp'],
  ['curl-polea', 'webp'],
  ['curl-polea-alta', 'webp'],
  ['curl-predicador', 'webp'],
  ['dead-bug', 'webp'],
  ['elevacion-piernas', 'webp'],
  ['elevacion-piernas-colgado', 'webp'],
  ['elevacion-rodillas-silla', 'webp'],
  ['elevaciones-frontales', 'webp'],
  ['elevaciones-laterales', 'webp'],
  ['encogimientos', 'webp'],
  ['extension-cuadriceps', 'webp'],
  ['extension-triceps-unilateral', 'webp'],
  ['extension-unilateral', 'webp'],
  ['face-pull', 'webp'],
  ['farmer-walk', 'webp'],
  ['femoral-unilateral', 'webp'],
  ['flexiones', 'webp'],
  ['fondos', 'webp'],
  ['frog-pumps', 'webp'],
  ['gemelos', 'webp'],
  ['gemelos-prensa', 'webp'],
  ['gemelos-sentado', 'webp'],
  ['hack-squat', 'webp'],
  ['hip-thrust', 'webp'],
  ['hiperextensiones', 'webp'],
  ['jalon-agarre-cerrado', 'webp'],
  ['jalon-neutro', 'webp'],
  ['jalon-pecho', 'webp'],
  ['kettlebell-swing', 'webp'],
  ['maquina-aductores', 'webp'],
  ['mountain-climbers', 'webp'],
  ['multi-hip', 'webp'],
  ['pajaros', 'webp'],
  ['patada-gluteo-polea', 'webp'],
  ['patada-triceps', 'webp'],
  ['pec-deck', 'webp'],
  ['peso-muerto', 'webp'],
  ['peso-muerto-rumano', 'webp'],
  ['peso-muerto-rumano-mancuernas', 'webp'],
  ['peso-muerto-sumo', 'webp'],
  ['plancha', 'webp'],
  ['plancha-lateral', 'webp'],
  ['prensa', 'webp'],
  ['press-banca', 'webp'],
  ['press-cerrado', 'webp'],
  ['press-frances', 'webp'],
  ['press-hombro-mancuernas', 'webp'],
  ['press-inclinado', 'webp'],
  ['press-maquina', 'webp'],
  ['press-militar', 'webp'],
  ['press-plano-mancuernas', 'webp'],
  ['puente-gluteos', 'webp'],
  ['pull-through', 'webp'],
  ['pullover', 'webp'],
  ['pullover-mancuerna', 'webp'],
  ['remo-barra', 'webp'],
  ['remo-hammer', 'webp'],
  ['remo-mancuerna', 'webp'],
  ['remo-maquina-apoyo', 'webp'],
  ['remo-menton', 'webp'],
  ['remo-sentado', 'webp'],
  ['rueda-abdominal', 'webp'],
  ['russian-twist', 'webp'],
  ['sentadilla', 'webp'],
  ['sentadilla-frontal', 'webp'],
  ['sentadilla-goblet', 'webp'],
  ['sentadilla-libre-trasera', 'webp'],
  ['sentadilla-smith', 'webp'],
  ['sentadilla-sumo', 'webp'],
  ['sissy-squat', 'webp'],
  ['subida-cajon', 'webp'],
  ['triceps-polea', 'webp'],
  ['triceps-sobre-cabeza', 'webp'],
  ['zancadas', 'webp'],
]);

/**
 * Fotos ORIGINALES, sin recortar, tal como las tomó el entrenador en el
 * gimnasio — para el visor ampliado (tocar la foto de referencia y verla
 * completa). Son un archivo aparte de `ILUSTRACIONES_DISPONIBLES`: esas ya
 * están recortadas/procesadas para la miniatura chica de la tarjeta, y
 * recortar de nuevo esa versión no devuelve la foto completa que se pidió.
 *
 * Viven en public/ejercicios-completas/<slug>.webp, redimensionadas a 1400px
 * de ancho (no recortadas, mismo encuadre completo del original) para no
 * pesar varios MB por foto — ver `resize-fotos-completas.mjs` en la raíz del
 * repo, que las generó a partir de `_fotos_ejercicios_staging/`.
 *
 * Todavía no todos los ejercicios tienen su foto completa identificada: el
 * componente cae a la miniatura recortada cuando no hay entrada acá.
 */
const FOTOS_COMPLETAS_DISPONIBLES = new Set([
  "aductores", "aperturas-inclinado", "aperturas-polea", "aperturas", "belt-squat",
  "bicicleta", "buenos-dias", "bulgara", "burpees", "crunch-maquina", "crunch-polea",
  "crunch", "curl-barra", "curl-concentrado", "curl-femoral-sentado", "curl-femoral",
  "curl-inclinado", "curl-martillo", "curl-polea-alta", "curl-polea", "curl-predicador",
  "dead-bug", "elevacion-piernas-colgado", "elevacion-piernas", "elevacion-rodillas-silla",
  "elevaciones-frontales", "elevaciones-laterales", "encogimientos", "extension-cuadriceps",
  "extension-unilateral", "face-pull", "farmer-walk", "femoral-unilateral", "flexiones",
  "fondos", "frog-pumps", "hack-squat", "hip-thrust", "hiperextensiones",
  "jalon-agarre-cerrado", "jalon-pecho", "kettlebell-swing", "maquina-aductores",
  "mountain-climbers", "multi-hip", "pajaros", "patada-gluteo-polea", "patada-triceps",
  "peso-muerto-rumano-mancuernas", "peso-muerto-rumano", "peso-muerto-sumo", "peso-muerto",
  "plancha-lateral", "plancha", "prensa", "press-banca", "press-cerrado", "press-frances",
  "press-hombro-mancuernas", "press-inclinado", "press-maquina", "press-militar",
  "press-plano-mancuernas", "puente-gluteos", "pull-through", "pullover-mancuerna",
  "pullover", "remo-barra", "remo-hammer", "remo-mancuerna", "remo-menton", "remo-sentado",
  "rueda-abdominal", "russian-twist", "sentadilla-frontal", "sentadilla-goblet",
  "sentadilla-libre-trasera", "sentadilla-smith", "sentadilla-sumo", "sentadilla",
  "sissy-squat", "subida-cajon", "triceps-polea", "triceps-sobre-cabeza", "zancadas",
]);

/** La foto completa del ejercicio para el visor ampliado, o `null` si todavía
 * no se identificó cuál es (el visor cae a la miniatura recortada en ese
 * caso — sigue siendo la foto entera, solo que ya venía recortada de antes). */
export function resolverFotoCompleta(ilustracionSlug: string | null | undefined): string | null {
  if (!ilustracionSlug || !FOTOS_COMPLETAS_DISPONIBLES.has(ilustracionSlug)) return null;
  return `/ejercicios-completas/${ilustracionSlug}.webp`;
}

export function resolverIlustracion(
  ilustracionSlug: string | null | undefined,
  grupoMuscular: GrupoMuscular | null | undefined
): Ilustracion {
  const ext = ilustracionSlug ? ILUSTRACIONES_DISPONIBLES.get(ilustracionSlug) : undefined;
  if (ilustracionSlug && ext) {
    return { src: `/ejercicios/${ilustracionSlug}.${ext}`, origen: "ilustracion" };
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
