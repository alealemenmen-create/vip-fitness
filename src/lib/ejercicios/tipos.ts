import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";

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

export type IntensidadImpulsoEjercicio = "ninguna" | "baja" | "media" | "alta";
export type TecnicaImpulsoEjercicio =
  | "tempo_controlado"
  | "pausa_isometrica"
  | "serie_descarga"
  | "drop_set"
  | "rest_pause"
  | "fallo_controlado";

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
  videoCloudflareUid: string | null;
  videoCloudflareEstado: "subiendo" | "procesando" | "listo" | "error" | null;
  videoCloudflareDuracionSeg: number | null;
  videoCloudflareMiniaturaUrl: string | null;
  videoCloudflareError: string | null;
  /** Fotos subidas a mano desde /admin/ejercicios (bucket `ejercicios-fotos`
   * de Storage) — cuando existen, mandan por sobre `ilustracionSlug` (el
   * archivo estático de public/ejercicios). Ver 0042_fotos_ejercicios_admin. */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  fotoPanoramaX: number;
  fotoPanoramaY: number;
  fotoCuadradaX: number;
  fotoCuadradaY: number;
  /** Hash del contenido de la miniatura procesada (migración 0095). Detecta
   * duplicados exactos por contenido — la misma foto subida sin querer a dos
   * ejercicios distintos, algo que comparar URLs no puede ver. Nulo en fotos
   * subidas antes de esta migración: no hay backfill retroactivo. */
  fotoHash: string | null;
  /** Clasificación biomecánica estructurada (migración 0051). Nula en casi
   * toda la biblioteca todavía — mientras no se cargue, el generador sigue
   * clasificando por nombre (ver `patronMovimiento()` en lib/rutinas/patrones.ts). */
  patronMovimiento: PatronMovimiento | null;
  /** Perfil de seguridad explícito de Impulso VIP. Si no fue revisado, el
   * motor nunca debe interpretar el nombre del ejercicio para intensificarlo. */
  impulsoIntensidadMaxima: IntensidadImpulsoEjercicio;
  impulsoTecnicasPermitidas: TecnicaImpulsoEjercicio[];
  impulsoRequiereSupervision: boolean;
  impulsoPerfilRevisado: boolean;
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
export const COLUMNAS_EJERCICIO_MULTIMEDIA =
  `${COLUMNAS_EJERCICIO_CON_ENCUADRE}, video_cloudflare_uid, video_cloudflare_estado, ` +
  "video_cloudflare_duracion_seg, video_cloudflare_miniatura_url, video_cloudflare_error, patron_movimiento";
export const COLUMNAS_EJERCICIO_IMPULSO =
  `${COLUMNAS_EJERCICIO_MULTIMEDIA}, impulso_intensidad_maxima, impulso_tecnicas_permitidas, ` +
  "impulso_requiere_supervision, impulso_perfil_revisado";
/** Con el hash de contenido de la foto (migración 0095) — mismo criterio de
 * respaldo que las demás columnas nuevas: puede fallar si esa migración
 * todavía no corrió, y quien la use debe caer a `COLUMNAS_EJERCICIO_IMPULSO`. */
export const COLUMNAS_EJERCICIO_IMPULSO_CON_HASH = `${COLUMNAS_EJERCICIO_IMPULSO}, foto_hash`;

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
  video_cloudflare_uid?: string | null;
  video_cloudflare_estado?: "subiendo" | "procesando" | "listo" | "error" | null;
  video_cloudflare_duracion_seg?: number | null;
  video_cloudflare_miniatura_url?: string | null;
  video_cloudflare_error?: string | null;
  foto_miniatura_url?: string | null;
  foto_completa_url?: string | null;
  foto_panorama_x?: number | null;
  foto_panorama_y?: number | null;
  foto_cuadrada_x?: number | null;
  foto_cuadrada_y?: number | null;
  foto_hash?: string | null;
  patron_movimiento?: PatronMovimiento | null;
  impulso_intensidad_maxima?: IntensidadImpulsoEjercicio | null;
  impulso_tecnicas_permitidas?: TecnicaImpulsoEjercicio[] | null;
  impulso_requiere_supervision?: boolean | null;
  impulso_perfil_revisado?: boolean | null;
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
    videoCloudflareEstado: fila.video_cloudflare_estado ?? null,
    videoCloudflareDuracionSeg: fila.video_cloudflare_duracion_seg ?? null,
    videoCloudflareMiniaturaUrl: fila.video_cloudflare_miniatura_url ?? null,
    videoCloudflareError: fila.video_cloudflare_error ?? null,
    fotoMiniaturaUrl: fila.foto_miniatura_url ?? null,
    fotoCompletaUrl: fila.foto_completa_url ?? null,
    fotoPanoramaX: fila.foto_panorama_x ?? 50,
    fotoPanoramaY: fila.foto_panorama_y ?? 50,
    fotoCuadradaX: fila.foto_cuadrada_x ?? 50,
    fotoCuadradaY: fila.foto_cuadrada_y ?? 50,
    fotoHash: fila.foto_hash ?? null,
    patronMovimiento: fila.patron_movimiento ?? null,
    impulsoIntensidadMaxima: fila.impulso_intensidad_maxima ?? "ninguna",
    impulsoTecnicasPermitidas: fila.impulso_tecnicas_permitidas ?? [],
    impulsoRequiereSupervision: fila.impulso_requiere_supervision ?? true,
    impulsoPerfilRevisado: fila.impulso_perfil_revisado ?? false,
  };
}
