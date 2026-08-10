export type ObjetivosAlimentacion = {
  kcalObjetivo: number | null;
  protObjetivo: number | null;
  carbObjetivo: number | null;
  grasaObjetivo: number | null;
};

export type ReconciliacionObjetivos = {
  objetivos: ObjetivosAlimentacion;
  ajustado: boolean;
  error: string | null;
  kcalCalculadas: number | null;
};

export function caloriasDeMacros(
  proteina: number | null,
  carbohidratos: number | null,
  grasa: number | null
): number | null {
  if (proteina === null || carbohidratos === null || grasa === null) return null;
  return proteina * 4 + carbohidratos * 4 + grasa * 9;
}

/**
 * Hace que la meta publicada sea matemáticamente posible. Las calorías son
 * la meta principal; proteína y grasa se conservan porque son los anclajes
 * fisiológicos definidos por el entrenador, y carbohidratos cierra la
 * diferencia. Una diferencia pequeña se considera redondeo y no se toca.
 */
export function reconciliarObjetivos(
  entrada: ObjetivosAlimentacion
): ReconciliacionObjetivos {
  const objetivos = { ...entrada };
  const { kcalObjetivo, protObjetivo, grasaObjetivo } = objetivos;

  if (
    kcalObjetivo === null ||
    protObjetivo === null ||
    grasaObjetivo === null ||
    kcalObjetivo <= 0
  ) {
    return {
      objetivos,
      ajustado: false,
      error: null,
      kcalCalculadas: caloriasDeMacros(
        protObjetivo,
        objetivos.carbObjetivo,
        grasaObjetivo
      ),
    };
  }

  const kcalAnclajes = protObjetivo * 4 + grasaObjetivo * 9;
  if (kcalAnclajes > kcalObjetivo) {
    return {
      objetivos,
      ajustado: false,
      error:
        `Proteína y grasas ya suman ${Math.round(kcalAnclajes)} kcal, ` +
        `por encima de la meta de ${Math.round(kcalObjetivo)} kcal. Revisa esos valores.`,
      kcalCalculadas: caloriasDeMacros(
        protObjetivo,
        objetivos.carbObjetivo,
        grasaObjetivo
      ),
    };
  }

  const carbohidratosCierre = Math.max(
    0,
    Math.round((kcalObjetivo - kcalAnclajes) / 4)
  );
  const kcalCalculadas = caloriasDeMacros(
    protObjetivo,
    objetivos.carbObjetivo,
    grasaObjetivo
  );
  const tolerancia = Math.max(50, kcalObjetivo * 0.03);
  const necesitaAjuste =
    objetivos.carbObjetivo === null ||
    kcalCalculadas === null ||
    Math.abs(kcalCalculadas - kcalObjetivo) > tolerancia;

  if (necesitaAjuste) objetivos.carbObjetivo = carbohidratosCierre;

  return {
    objetivos,
    ajustado: necesitaAjuste,
    error: null,
    kcalCalculadas: caloriasDeMacros(
      protObjetivo,
      objetivos.carbObjetivo,
      grasaObjetivo
    ),
  };
}
