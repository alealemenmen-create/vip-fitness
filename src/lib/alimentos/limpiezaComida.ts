/**
 * Una franja horaria sin alimentos no aporta nada a la línea de tiempo y, si
 * se conserva, infla los registros y termina afectando auditorías. Se mantiene
 * únicamente cuando contiene información propia: una observación o la marca
 * explícita de comida omitida.
 */
export function debeEliminarComidaVacia({
  alimentosRestantes,
  omitida,
  observacion,
}: {
  alimentosRestantes: number;
  omitida: boolean;
  observacion: string | null;
}): boolean {
  return alimentosRestantes === 0 && !omitida && !observacion?.trim();
}
