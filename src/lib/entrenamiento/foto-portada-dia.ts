import type { GrupoMuscular } from "@/app/alumno/entrenar/data";
import { resolverFotoCompleta, resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import { FOTOS_PREFERIDAS_POR_GRUPO } from "@/lib/grupos-musculares/fotos-preferidas";
import { cardioIdentificaElDia } from "./grupos-dia";

export type EjercicioParaPortada = {
  ilustracionSlug: string | null;
  grupoMuscular: GrupoMuscular | null;
};

/** Ejercicios candidatos para la foto de portada del día: si cardio no
 * alcanza a identificar el día (ver `cardioIdentificaElDia`), sus ejercicios
 * quedan afuera -- así un calentamiento de bicicleta antes de espalda no
 * termina siendo la portada de un día de musculación (pedido de Alejandro,
 * 2026-08-21: "meto la bicicleta [de calentamiento] pero no significa que
 * sea cardio"). */
export function candidatosFotoPortada<T extends EjercicioParaPortada>(ejercicios: T[]): T[] {
  const grupos = ejercicios.map((ejercicio) => ejercicio.grupoMuscular).filter((grupo): grupo is GrupoMuscular => Boolean(grupo));
  if (cardioIdentificaElDia(grupos)) return ejercicios;
  return ejercicios.filter((ejercicio) => ejercicio.grupoMuscular !== "cardio");
}

/** La mejor foto de portada del día, o `null` si ningún ejercicio candidato
 * tiene una foto o ilustración identificada todavía (el llamador cae al
 * dibujo anatómico de respaldo en ese caso).
 *
 * Prioriza la foto CURADA de algún ejercicio del día (ver
 * `FOTOS_PREFERIDAS_POR_GRUPO`) por sobre "la primera que aparezca"; si
 * ninguno de los ejercicios del día está en esa lista, cae a la primera foto
 * completa disponible, y después a la primera ilustración recortada. */
export function fotoPortadaDia(ejercicios: EjercicioParaPortada[]): string | null {
  const candidatos = candidatosFotoPortada(ejercicios);

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
  const fotoCurada = mejorSlug ? resolverFotoCompleta(mejorSlug) : null;
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
