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
  /** Link externo (YouTube o archivo directo) — ver `guardarVideoEjercicio`. */
  videoUrl: string | null;
  /** Video subido de verdad a Cloudflare Stream (ver 0048_video_cloudflare_stream
   * y `src/lib/cloudflare/stream.ts`) — cuando `videoCloudflareListo` es true,
   * manda por sobre `videoUrl`. Mientras es false, Cloudflare todavía lo está
   * procesando y no hay que ofrecerlo para reproducir. */
  videoCloudflareUid: string | null;
  videoCloudflareListo: boolean;
  /** Fotos subidas a mano desde /admin/ejercicios (bucket `ejercicios-fotos`
   * de Storage) — cuando existen, mandan por sobre `ilustracionSlug` (el
   * archivo estático de public/ejercicios). Ver 0042_fotos_ejercicios_admin. */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
};

/** Columnas a pedir cuando se lee la biblioteca. */
export const COLUMNAS_EJERCICIO_SIN_FOTOS =
  "id, slug, nombre, aliases, grupo_muscular, grupos_secundarios, categoria, equipo, nivel, " +
  "descripcion_corta, tecnica, errores_comunes, consejos, ilustracion_slug, video_url";
/** Con las fotos de admin (migración 0042) y el video de Cloudflare Stream
 * (migración 0048) — puede fallar si esas migraciones todavía no corrieron;
 * quien la use debe tener el respaldo a la de arriba. Van juntas en el mismo
 * nivel porque las dos son "opcionales hasta que se corra la migración", no
 * porque tengan relación entre sí. */
export const COLUMNAS_EJERCICIO = `${COLUMNAS_EJERCICIO_SIN_FOTOS}, foto_miniatura_url, foto_completa_url, video_cloudflare_uid, video_cloudflare_listo`;

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
  video_cloudflare_uid?: string | null;
  video_cloudflare_listo?: boolean | null;
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
    videoCloudflareUid: fila.video_cloudflare_uid ?? null,
    videoCloudflareListo: fila.video_cloudflare_listo ?? false,
    fotoMiniaturaUrl: fila.foto_miniatura_url ?? null,
    fotoCompletaUrl: fila.foto_completa_url ?? null,
  };
}
