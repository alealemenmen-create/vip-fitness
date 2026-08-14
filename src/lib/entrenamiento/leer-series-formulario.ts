export type SerieFormulario = {
  sesion_ejercicio_id: string;
  numero_serie: number;
  peso_kg: number | null;
  es_peso_corporal: boolean;
  reps_realizadas: number | null;
  rir_estimado: number | null;
  realizada: boolean;
};

export type SeriesFormularioLeidas =
  | { ok: true; filas: SerieFormulario[]; seriesRealizadas: number }
  | { ok: false; error: string };

function numeroOpcional(valor: FormDataEntryValue | null, decimal: boolean): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(decimal ? texto.replace(",", ".") : texto);
  return Number.isFinite(numero) ? numero : Number.NaN;
}

/** Lee un ejercicio del formulario compartido. El sufijo es parte de la
 * identidad del ejercicio dentro de una biserie: A usa "", B usa "_1", C
 * usa "_2". Mantenerlo en una función pura permite demostrar que los pesos
 * de dos ejercicios con el mismo número de serie nunca se pisan. */
export function leerSeriesFormulario(
  formData: FormData,
  sesionEjercicioId: string,
  cantidad: number,
  sufijo: string
): SeriesFormularioLeidas {
  const filas: SerieFormulario[] = [];
  let seriesRealizadas = 0;

  for (let numero = 1; numero <= cantidad; numero++) {
    const esPesoCorporal = formData.get(`peso_corporal_${numero}${sufijo}`) === "true";
    const realizada = formData.get(`realizada_${numero}${sufijo}`) === "true";
    const peso = esPesoCorporal ? null : numeroOpcional(formData.get(`peso_${numero}${sufijo}`), true);
    const reps = numeroOpcional(formData.get(`reps_${numero}${sufijo}`), false);
    const rir = numeroOpcional(formData.get(`rir_${numero}${sufijo}`), false);

    if (peso !== null && (!Number.isFinite(peso) || peso < 0 || peso > 1000)) {
      return { ok: false, error: "Ingresa un peso válido entre 0 y 1000 kg." };
    }
    if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 10000)) {
      return { ok: false, error: "Ingresa repeticiones válidas." };
    }
    if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 5)) {
      return { ok: false, error: "El RIR debe estar entre 0 y 5." };
    }
    if (realizada) seriesRealizadas++;
    if (peso === null && reps === null && !esPesoCorporal && !realizada) continue;

    filas.push({
      sesion_ejercicio_id: sesionEjercicioId,
      numero_serie: numero,
      peso_kg: peso,
      es_peso_corporal: esPesoCorporal,
      reps_realizadas: reps,
      rir_estimado: rir,
      realizada,
    });
  }

  return { ok: true, filas, seriesRealizadas };
}
