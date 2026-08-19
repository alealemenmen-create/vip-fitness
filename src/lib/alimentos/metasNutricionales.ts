export type MetasNutricionales = {
  kcal: number | null;
  prot: number | null;
  carb: number | null;
  grasa: number | null;
};

/**
 * Regla única para los dos editores de macros (portal original y V2).
 *
 * La base exige calorías mayores que cero y macros no negativos. Validarlo
 * antes de insertar evita convertir un error de dominio en el mensaje opaco
 * de PostgreSQL "No fue posible guardar".
 */
export function errorMetasNutricionales(metas: MetasNutricionales): string | null {
  if (metas.kcal === null || !Number.isFinite(metas.kcal)) {
    return "Falta la meta de calorías.";
  }
  if (metas.kcal <= 0) {
    return "La meta de calorías debe ser mayor que cero.";
  }

  const macros = [metas.prot, metas.carb, metas.grasa];
  if (macros.some((valor) => valor !== null && (!Number.isFinite(valor) || valor < 0))) {
    return "Las metas de proteína, carbohidratos y grasas no pueden ser negativas.";
  }

  return null;
}
