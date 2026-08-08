import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

export type NivelEjercicio = "principiante" | "intermedio" | "avanzado";

export type CategoriaEjercicio =
  | "empuje"
  | "traccion"
  | "pierna"
  | "core"
  | "cardio"
  | "aislamiento"
  | "full_body";

export type EquipoEjercicio =
  | "barra"
  | "mancuerna"
  | "polea"
  | "maquina"
  | "smith"
  | "peso_corporal"
  | "kettlebell"
  | "banda"
  | "banco"
  | "otro";

/** Una entrada de la biblioteca maestra (tabla `ejercicios`). */
export type Ejercicio = {
  id: string;
  slug: string;
  nombre: string;
  aliases: string[];
  grupoMuscular: GrupoMuscular;
  gruposSecundarios: string[];
  categoria: CategoriaEjercicio;
  equipo: EquipoEjercicio;
  nivel: NivelEjercicio;
  descripcionCorta: string | null;
  tecnica: string | null;
  erroresComunes: string[];
  consejos: string[];
  /** Qué dibujo le toca. Va aparte del slug porque varios ejercicios
   * comparten ilustración a propósito. */
  ilustracionSlug: string | null;
  videoUrl: string | null;
  /** Fotos subidas a mano desde /admin/ejercicios (bucket `ejercicios-fotos`
   * de Storage) — cuando existen, mandan por sobre `ilustracionSlug` (el
   * archivo estático de public/ejercicios). Ver 0042_fotos_ejercicios_admin. */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  fotoPanoramaX: number;
  fotoPanoramaY: number;
  fotoCuadradaX: number;
  fotoCuadradaY: number;
};

/** Columnas a pedir cuando se lee la biblioteca. */
export const COLUMNAS_EJERCICIO_SIN_FOTOS =
  "id, slug, nombre, aliases, grupo_muscular, grupos_secundarios, categoria, equipo, nivel, " +
  "descripcion_corta, tecnica, errores_comunes, consejos, ilustracion_slug, video_url";
/** Con las fotos de admin (migración 0042) — puede fallar si esa migración
 * todavía no corrió; quien la use debe tener el respaldo a la de arriba. */
export const COLUMNAS_EJERCICIO = `${COLUMNAS_EJERCICIO_SIN_FOTOS}, foto_miniatura_url, foto_completa_url`;
export const COLUMNAS_EJERCICIO_CON_ENCUADRE =
  `${COLUMNAS_EJERCICIO}, foto_panorama_x, foto_panorama_y, foto_cuadrada_x, foto_cuadrada_y`;

type FilaEjercicio = {
  id: string;
  slug: string;
  nombre: string;
  aliases: string[] | null;
  grupo_muscular: GrupoMuscular;
  grupos_secundarios: string[] | null;
  categoria: CategoriaEjercicio;
  equipo: EquipoEjercicio;
  nivel: NivelEjercicio;
  descripcion_corta: string | null;
  tecnica: string | null;
  errores_comunes: string[] | null;
  consejos: string[] | null;
  ilustracion_slug: string | null;
  video_url: string | null;
  foto_miniatura_url?: string | null;
  foto_completa_url?: string | null;
  foto_panorama_x?: number | null;
  foto_panorama_y?: number | null;
  foto_cuadrada_x?: number | null;
  foto_cuadrada_y?: number | null;
};

export function aEjercicio(fila: FilaEjercicio): Ejercicio {
  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.nombre,
    aliases: fila.aliases ?? [],
    grupoMuscular: fila.grupo_muscular,
    gruposSecundarios: fila.grupos_secundarios ?? [],
    categoria: fila.categoria,
    equipo: fila.equipo,
    nivel: fila.nivel,
    descripcionCorta: fila.descripcion_corta,
    tecnica: fila.tecnica,
    erroresComunes: fila.errores_comunes ?? [],
    consejos: fila.consejos ?? [],
    ilustracionSlug: fila.ilustracion_slug,
    videoUrl: fila.video_url,
    fotoMiniaturaUrl: fila.foto_miniatura_url ?? null,
    fotoCompletaUrl: fila.foto_completa_url ?? null,
    fotoPanoramaX: fila.foto_panorama_x ?? 50,
    fotoPanoramaY: fila.foto_panorama_y ?? 50,
    fotoCuadradaX: fila.foto_cuadrada_x ?? 50,
    fotoCuadradaY: fila.foto_cuadrada_y ?? 50,
  };
}
