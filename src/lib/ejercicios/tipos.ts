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
};

/** Columnas a pedir cuando se lee la biblioteca. */
export const COLUMNAS_EJERCICIO =
  "id, slug, nombre, aliases, grupo_muscular, grupos_secundarios, categoria, equipo, nivel, " +
  "descripcion_corta, tecnica, errores_comunes, consejos, ilustracion_slug, video_url";

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
  };
}
