/**
 * Máquina de estados del tramo final de Impulso VIP: decide si el ejercicio
 * activo puede avanzar al siguiente o si todavía queda un Momento Impulso
 * sin resolver.
 *
 * Secuencia completa de una intervención con reto real (no
 * `tempo_controlado` automática):
 *   serie finalizada → RIR pendiente (calibración) → reto pendiente
 *   (aceptar/rechazar) → resultado pendiente (¿cómo salió?) → resuelta.
 *
 * Los dos primeros tramos (RIR y reto) ya bloquean la propia serie objetivo
 * — `bloqueadaPorImpulso` en `FilaSerie`, calculado por
 * `bloqueosImpulsoPorSerie` en `SesionEjercicioCard` — así que mientras no
 * se respondan, la serie ni siquiera se puede marcar "hecha" y el ejercicio
 * no llega a estar completo. Esta función cubre el tramo que SÍ podía
 * saltarse: una vez que la serie objetivo ya está marcada hecha, el
 * resultado ("¿Cómo salió?", dentro de `MomentoImpulsoEnVivo`) puede seguir
 * pendiente mientras la encuesta general "¿Cómo sentiste este ejercicio?"
 * (`SelectorDificultad`) ya está disponible — antes de este arreglo,
 * responder esa encuesta general avanzaba el ejercicio activo aunque el
 * resultado de Impulso siguiera sin confirmar, y la tarjeta de resultado
 * quedaba huérfana en el ejercicio anterior.
 */

export type EstadoIntervencionImpulso = "preparada" | "mostrada" | "resuelta" | "cancelada";

export type IntervencionParaAvance = {
  id: string;
  serieObjetivo: number;
  tipo: string;
  origen: string;
  estado: EstadoIntervencionImpulso;
};

/**
 * Las notas de orientación automáticas (`tempo_controlado`, escritas por el
 * motor/entrenador como técnica de mitad de ejercicio, `origen ===
 * "metodo_ale"`) no tienen reto que aceptar ni resultado que confirmar — se
 * cierran solas con "Cerrar indicación" (ver `esNotaOrientacion` en
 * `MomentoImpulsoEnVivo.tsx`). Un mensaje PERSONAL de Ale con esa misma
 * técnica (`origen` "personal_ale"/"preparada_por_ale") sí pide resultado,
 * porque ahí Ale espera saber cómo salió.
 */
export function requiereResultado(
  intervencion: Pick<IntervencionParaAvance, "tipo" | "origen">
): boolean {
  return !(intervencion.tipo === "tempo_controlado" && intervencion.origen === "metodo_ale");
}

/**
 * `true` si hay al menos una intervención cuya serie objetivo ya se marcó
 * hecha pero cuyo resultado todavía no está resuelto — ni de forma
 * optimista en el cliente (`resultadosLocales`, se llena apenas la Server
 * Action de `resolverIntervencionEnVivo` responde `ok`, sin esperar a que
 * la revalidación de la página vuelva a traer `estado: "resuelta"`) ni en
 * el último dato conocido del servidor (`intervencion.estado`).
 *
 * Mientras esto sea `true`, el ejercicio activo no puede darse por
 * terminado: ver el uso en `SesionEjercicioCard` (`disabled` de
 * `SelectorDificultad`), que es lo único que dispara el avance
 * (`onDificultadRespondida` → `avanzarDesdeEncuesta` en
 * `SesionEjercicios.tsx`).
 */
export function impulsoPendienteDeAvance(
  intervenciones: readonly IntervencionParaAvance[],
  seriesHechas: ReadonlySet<number>,
  resultadosLocales: Readonly<Record<string, boolean>> = {}
): boolean {
  return intervenciones.some((intervencion) => {
    if (intervencion.estado === "cancelada") return false;
    if (!requiereResultado(intervencion)) return false;
    if (!seriesHechas.has(intervencion.serieObjetivo)) return false;
    const resuelta = resultadosLocales[intervencion.id] ?? intervencion.estado === "resuelta";
    return !resuelta;
  });
}

export type SerieParaAvance = { numeroSerie: number; realizada: boolean };

/**
 * `ejercicio.completado` es la foto fría que trae una recarga de página (ver
 * el comentario sobre esa columna en `SesionEjercicios.tsx`): puede ser
 * `true` — la serie objetivo alcanza para cerrar el ejercicio en la base —
 * con un resultado de Impulso VIP todavía sin confirmar, si el alumno cerró
 * la app antes de contestar "¿Cómo salió?". Bug real, 2026-08-19: sin este
 * chequeo, recargar en ese momento saltaba derecho al siguiente ejercicio
 * (`indiceActivo` en `SesionEjercicios.tsx` solo miraba `completado`) y la
 * tarjeta de resultado quedaba huérfana en el ejercicio anterior — el mismo
 * bug de fondo que `impulsoPendienteDeAvance` corrige para la sesión en
 * vivo, acá aplicado al primer render tras una recarga.
 */
export function ejercicioResueltoDeVerdad(ejercicio: {
  completado: boolean;
  series: readonly SerieParaAvance[];
  intervencionesImpulso: readonly IntervencionParaAvance[];
}): boolean {
  if (!ejercicio.completado) return false;
  const seriesHechas = new Set(
    ejercicio.series.filter((s) => s.realizada).map((s) => s.numeroSerie)
  );
  return !impulsoPendienteDeAvance(ejercicio.intervencionesImpulso, seriesHechas);
}
