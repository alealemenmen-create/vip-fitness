export type FilaConPuntos = {
  puntos: number;
  puntosAcumulados: number;
  nombre: string;
  posicion: number;
};

/** Ordena una competencia por los puntos del periodo y asigna puestos con
 * empate real (1, 2, 3, 3, 3, 6). El acumulado sirve para el rango personal,
 * no como desempate oculto de una semana o un mes. */
export function ordenarYPosicionar<T extends FilaConPuntos>(filas: T[]): T[] {
  filas.sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre));
  let puntosPrevios: number | null = null;
  let posicionPrevia = 0;
  filas.forEach((fila, indice) => {
    if (puntosPrevios === null || fila.puntos !== puntosPrevios) posicionPrevia = indice + 1;
    fila.posicion = posicionPrevia;
    puntosPrevios = fila.puntos;
  });
  return filas;
}

export function rivalInmediatamenteSuperior<T extends Pick<FilaConPuntos, "puntos">>(
  filas: T[],
  puntosPropios: number
): T | null {
  return [...filas].reverse().find((fila) => fila.puntos > puntosPropios) ?? null;
}
