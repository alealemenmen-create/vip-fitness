import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import { resolverFotoCompleta, resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import { FOTOS_PREFERIDAS_POR_GRUPO } from "@/lib/grupos-musculares/fotos-preferidas";
import { cardioIdentificaElDia } from "./grupos-dia";

export type GrupoPortadaEditorial = GrupoMuscular | "gluteos";

/** Dos portadas por familia, separadas de las fotos técnicas de ejercicios. */
export const PORTADAS_EDITORIALES_POR_GRUPO: Readonly<Record<GrupoPortadaEditorial, readonly [string, string]>> = {
  pecho: [
    "/portadas-entrenamiento/press-inclinado-vip-v2.webp",
    "/portadas-entrenamiento/pecho-press-banca-vip-v2.webp",
  ],
  espalda: [
    "/portadas-entrenamiento/jalon-pecho-vip-v2.webp",
    "/portadas-entrenamiento/espalda-remo-barra-vip-v2.webp",
  ],
  hombros: [
    "/portadas-entrenamiento/elevaciones-laterales-vip-v2.webp",
    "/portadas-entrenamiento/hombros-press-mancuernas-vip-v2.webp",
  ],
  brazos: [
    "/portadas-entrenamiento/brazos-biceps-vip-v2.webp",
    "/portadas-entrenamiento/brazos-triceps-vip-v2.webp",
  ],
  piernas: [
    "/portadas-entrenamiento/prensa-vip-v2.webp",
    "/portadas-entrenamiento/piernas-sentadilla-vip-v2.webp",
  ],
  gluteos: [
    "/portadas-entrenamiento/gluteos-hip-thrust-vip-v2.webp",
    "/portadas-entrenamiento/gluteos-patada-vip-v2.webp",
  ],
  core: [
    "/portadas-entrenamiento/core-plancha-vip-v2.webp",
    "/portadas-entrenamiento/core-rueda-vip-v2.webp",
  ],
  cardio: [
    "/portadas-entrenamiento/cardio-bicicleta-vip-v2.webp",
    "/portadas-entrenamiento/cardio-burpee-vip-v2.webp",
  ],
};

export type EjercicioParaPortada = {
  ilustracionSlug: string | null;
  grupoMuscular: GrupoMuscular | null;
  nombre?: string | null;
};

export type ContextoPortadaDia = {
  nombreDia?: string | null;
  gruposMusculares?: readonly GrupoMuscular[];
  /** ID estable del día o índice explícito para alternar las dos variantes. */
  variante?: string | number | null;
};

/** Evita que una bicicleta de calentamiento identifique un día de fuerza. */
export function candidatosFotoPortada<T extends EjercicioParaPortada>(ejercicios: T[]): T[] {
  const grupos = ejercicios.map((ejercicio) => ejercicio.grupoMuscular).filter((grupo): grupo is GrupoMuscular => Boolean(grupo));
  if (cardioIdentificaElDia(grupos)) return ejercicios;
  return ejercicios.filter((ejercicio) => ejercicio.grupoMuscular !== "cardio");
}

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function esDiaGluteos(ejercicios: EjercicioParaPortada[], nombreDia?: string | null): boolean {
  if (/glute/.test(normalizar(nombreDia))) return true;
  const slugsGluteos = /hip-thrust|glute|frog-pump|pull-through|patada-gluteo|multi-hip/;
  const piernas = ejercicios.filter((ejercicio) => ejercicio.grupoMuscular === "piernas");
  if (piernas.length === 0) return false;
  const gluteos = piernas.filter((ejercicio) => slugsGluteos.test(normalizar(`${ejercicio.ilustracionSlug} ${ejercicio.nombre}`)));
  return gluteos.length >= 2 && gluteos.length * 2 >= piernas.length;
}

export function grupoPortadaDia(
  ejercicios: EjercicioParaPortada[],
  contexto: ContextoPortadaDia = {}
): GrupoPortadaEditorial | null {
  const candidatos = candidatosFotoPortada(ejercicios);
  const gruposCandidatos = candidatos
    .map((ejercicio) => ejercicio.grupoMuscular)
    .filter((grupo): grupo is GrupoMuscular => Boolean(grupo));
  const gruposContexto = (contexto.gruposMusculares ?? []).filter((grupo) =>
    grupo !== "cardio" || cardioIdentificaElDia(gruposCandidatos)
  );
  const principal = gruposContexto[0] ?? gruposCandidatos[0] ?? null;
  if (principal === "piernas" && esDiaGluteos(candidatos, contexto.nombreDia)) return "gluteos";
  return principal;
}

function indiceVariante(variante: ContextoPortadaDia["variante"]): 0 | 1 {
  if (typeof variante === "number") return Math.abs(Math.trunc(variante)) % 2 === 0 ? 0 : 1;
  if (!variante) return 0;
  let hash = 0;
  for (const caracter of variante) hash = (hash * 31 + caracter.charCodeAt(0)) | 0;
  return Math.abs(hash) % 2 === 0 ? 0 : 1;
}

/**
 * Elige una portada por grupo principal. Solo cae a una foto técnica cuando
 * el día no tiene ningún grupo identificable.
 */
export function fotoPortadaDia(
  ejercicios: EjercicioParaPortada[],
  contexto: ContextoPortadaDia = {}
): string | null {
  const candidatos = candidatosFotoPortada(ejercicios);
  const grupo = grupoPortadaDia(ejercicios, contexto);
  if (grupo) return PORTADAS_EDITORIALES_POR_GRUPO[grupo][indiceVariante(contexto.variante)];

  let mejorRango = Infinity;
  let mejorSlug: string | null = null;
  for (const ejercicio of candidatos) {
    if (!ejercicio.ilustracionSlug || !ejercicio.grupoMuscular) continue;
    const preferidos = FOTOS_PREFERIDAS_POR_GRUPO[ejercicio.grupoMuscular];
    const rango = preferidos?.indexOf(ejercicio.ilustracionSlug) ?? -1;
    if (rango >= 0 && rango < mejorRango) {
      mejorRango = rango;
      mejorSlug = ejercicio.ilustracionSlug;
    }
  }
  const fotoCurada = resolverFotoCompleta(mejorSlug);
  if (fotoCurada) return fotoCurada;

  const fotoCompleta = candidatos
    .map((ejercicio) => resolverFotoCompleta(ejercicio.ilustracionSlug))
    .find((src): src is string => Boolean(src));
  if (fotoCompleta) return fotoCompleta;

  const ilustracion = candidatos
    .map((ejercicio) => resolverIlustracion(ejercicio.ilustracionSlug, ejercicio.grupoMuscular))
    .find((item) => item.origen === "ilustracion");
  return ilustracion?.src ?? null;
}
