export type FichaCompatibilidadEjercicio = {
  id: string;
  grupoMuscular: string | null;
  categoria: string | null;
  activo: boolean;
  fichaCompleta: boolean;
};

export function validarConjuntoOrdenado(existentes: string[], propuesto: string[]) {
  if (propuesto.length === 0 || propuesto.length !== existentes.length) return false;
  if (new Set(propuesto).size !== propuesto.length) return false;
  const permitidos = new Set(existentes);
  return propuesto.every((id) => permitidos.has(id));
}

export function bloquesPermanecenUnidos(orden: string[], bloques: string[][]) {
  return bloques.every((bloque) => {
    if (bloque.length < 2) return true;
    const posiciones = bloque.map((id) => orden.indexOf(id));
    if (posiciones.some((posicion) => posicion < 0)) return false;
    const inicio = Math.min(...posiciones);
    return posiciones.every((posicion, indice) => posicion === inicio + indice);
  });
}

export function sustitucionEsCompatible(
  origen: FichaCompatibilidadEjercicio,
  sustituto: FichaCompatibilidadEjercicio,
) {
  if (origen.id === sustituto.id || !sustituto.activo || !sustituto.fichaCompleta) return false;
  if (!origen.grupoMuscular || origen.grupoMuscular !== sustituto.grupoMuscular) return false;
  return !origen.categoria || !sustituto.categoria || origen.categoria === sustituto.categoria;
}
