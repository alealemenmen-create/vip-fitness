export type FilaClasificacionComunidad = {
  alumnoId: string;
  puesto: number;
  esActual: boolean;
};

/**
 * Comunidad necesita contexto, no una réplica completa de Arena. Conserva el
 * top visible y, si el alumno está más abajo, añade su pequeña zona competitiva
 * para que siempre se encuentre sin obligar a pintar decenas de filas.
 */
export function resumirClasificacionComunidad<T extends FilaClasificacionComunidad>(
  filas: readonly T[],
  expandida: boolean,
  cantidadTop = 10,
): T[] {
  if (expandida || filas.length <= cantidadTop) return [...filas];

  const seleccionadas = new Set(filas.slice(0, cantidadTop).map((fila) => fila.alumnoId));
  const indiceActual = filas.findIndex((fila) => fila.esActual);
  if (indiceActual >= cantidadTop) {
    const desde = Math.max(cantidadTop, indiceActual - 1);
    const hasta = Math.min(filas.length, indiceActual + 2);
    for (const fila of filas.slice(desde, hasta)) seleccionadas.add(fila.alumnoId);
  }

  return filas.filter((fila) => seleccionadas.has(fila.alumnoId));
}
