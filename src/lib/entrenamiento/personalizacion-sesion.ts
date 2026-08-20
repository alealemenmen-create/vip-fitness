export type FichaCompatibilidadEjercicio = {
  id: string;
  grupoMuscular: string | null;
  categoria: string | null;
  patronMovimiento?: string | null;
  equipo?: string | null;
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
  if (origen.categoria && sustituto.categoria && origen.categoria !== sustituto.categoria) return false;
  // Si el origen ya tiene patron_movimiento cargado (ángulo/cabeza muscular
  // específica -- abducción vs aducción, cabeza de tríceps, flexión vs
  // extensión de rodilla), exigimos que el sustituto comparta exactamente
  // ese patrón. Antes bastaba con que grupo_muscular coincidiera, una
  // categoría demasiado amplia (p. ej. "piernas" mezcla abductor y
  // aductor, "brazos" mezcla bíceps y tríceps) que ofrecía sustitutos sin
  // sentido. Sin patrón cargado en el origen, seguimos con la comparación
  // más laxa de arriba (grupo + categoría) hasta que se clasifique.
  return !origen.patronMovimiento || origen.patronMovimiento === sustituto.patronMovimiento;
}

/** Dos cargas solo alimentan la misma progresión si el implemento también es
 * el mismo. Un press de 40 kg en máquina no equivale a 40 kg con mancuernas. */
export function cargasSonComparables(
  origen: FichaCompatibilidadEjercicio,
  sustituto: FichaCompatibilidadEjercicio,
) {
  return sustitucionEsCompatible(origen, sustituto)
    && Boolean(origen.equipo)
    && origen.equipo === sustituto.equipo;
}
