export type RegistroHistorialAlimentos = {
  fecha: string;
  comidas_registradas:
    | Array<{
        registrado_en: string | null;
        alimentos_consumidos: Array<{ alimento_id: string | null }> | null;
      }>
    | null;
};

/**
 * Devuelve alimentos usados recientemente, sin duplicados y sin confundir
 * "limpiar historial" con borrar comidas reales del diario.
 *
 * `alimentos_consumidos` no tiene fecha propia. La fuente de verdad es la
 * fecha del registro diario y, dentro de ese día, la hora en que se abrió la
 * comida. Los registros antiguos pueden no tener `registrado_en`; por eso la
 * fecha sigue siendo suficiente para mantenerlos detrás de los más nuevos.
 */
export function idsAlimentosRecientes(
  registros: RegistroHistorialAlimentos[],
  limite = 12,
): string[] {
  if (!Number.isInteger(limite) || limite <= 0) return [];

  const vistos = new Set<string>();
  const ids: string[] = [];
  const dias = [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha));

  for (const dia of dias) {
    const comidas = [...(dia.comidas_registradas ?? [])].sort((a, b) =>
      (b.registrado_en ?? "").localeCompare(a.registrado_en ?? ""),
    );
    for (const comida of comidas) {
      for (const consumido of comida.alimentos_consumidos ?? []) {
        const id = consumido.alimento_id;
        if (!id || vistos.has(id)) continue;
        vistos.add(id);
        ids.push(id);
        if (ids.length >= limite) return ids;
      }
    }
  }

  return ids;
}
