export type PesoParaResumen = {
  fecha: string;
  pesoKg: number;
  createdAt?: string;
};

export type ResumenPesos<T extends PesoParaResumen> = {
  historialDiario: T[];
  ultimo: T | null;
  variacionPeriodo: number | null;
};

/** Consolida datos históricos sin alterar filas en la base. Si existen varias
 * mediciones el mismo día —permitido por versiones antiguas— la más reciente
 * representa ese check-in y no una falsa subida/bajada adicional. */
export function resumirPesosDiarios<T extends PesoParaResumen>(
  registros: T[],
  desde: string,
  hasta: string,
): ResumenPesos<T> {
  const ordenados = [...registros].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  );
  const porFecha = new Map(ordenados.map((registro) => [registro.fecha, registro]));
  const historialDiario = [...porFecha.values()];
  const delPeriodo = historialDiario.filter((registro) => registro.fecha >= desde && registro.fecha <= hasta);
  const primero = delPeriodo.at(0)?.pesoKg ?? null;
  const ultimo = delPeriodo.at(-1)?.pesoKg ?? null;

  return {
    historialDiario,
    ultimo: historialDiario.at(-1) ?? null,
    variacionPeriodo: primero !== null && ultimo !== null && delPeriodo.length > 1
      ? Math.round((ultimo - primero) * 10) / 10
      : null,
  };
}
