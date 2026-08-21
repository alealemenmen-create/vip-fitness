import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/** Debajo de este número de ejercicios de cardio en el día, se asume que es
 * solo protocolo de calentamiento (activar sangre/músculo antes del trabajo
 * principal) -- no identifica al día. Alcanzado o superado, cardio SÍ cuenta
 * como uno de los grupos del día (rutina funcional/cardio de verdad).
 *
 * Pedido de Alejandro, 2026-08-21: "cuando haya tres, cuatro [ejercicios de
 * cardio] ya ahí sí es funcional o cardio" -- antes, una sola bicicleta de
 * calentamiento antes de espalda/pecho hacía que el día se mostrara como
 * "Cardio" (título, subtítulo y hasta la foto de portada), aunque el
 * trabajo principal fuera de musculación. */
export const UMBRAL_CARDIO_COMO_GRUPO = 3;

/** Grupos musculares que identifican al día, en el orden en que aparecen por
 * primera vez entre sus ejercicios. Cardio se excluye salvo que sea
 * literalmente el único tipo de ejercicio del día ("cuando es cardio es
 * porque todo es de cardio") o que alcance `UMBRAL_CARDIO_COMO_GRUPO`.
 *
 * Única fuente de verdad para esta regla: la usan tanto el resumen del día
 * (`obtenerDiasRutina`, título/subtítulo) como la elección de la foto de
 * portada (`EntrenamientoInicioV2`) -- antes cada uno decidía por su cuenta
 * si cardio "cuenta", y podían desalinearse. */
export function gruposIdentificadoresDia(
  gruposPorEjercicio: (GrupoMuscular | null | undefined)[]
): GrupoMuscular[] {
  const validos = gruposPorEjercicio.filter((grupo): grupo is GrupoMuscular => Boolean(grupo));
  const cardioCuenta = cardioIdentificaElDia(validos);
  return [...new Set(validos.filter((grupo) => grupo !== "cardio" || cardioCuenta))];
}

/** Si cardio alcanza a identificar el día (ver `gruposIdentificadoresDia`):
 * o todos los ejercicios son cardio, o hay al menos `UMBRAL_CARDIO_COMO_GRUPO`. */
export function cardioIdentificaElDia(gruposValidos: GrupoMuscular[]): boolean {
  if (gruposValidos.length === 0) return false;
  const cardioCount = gruposValidos.filter((grupo) => grupo === "cardio").length;
  const todosSonCardio = cardioCount === gruposValidos.length;
  return todosSonCardio || cardioCount >= UMBRAL_CARDIO_COMO_GRUPO;
}
