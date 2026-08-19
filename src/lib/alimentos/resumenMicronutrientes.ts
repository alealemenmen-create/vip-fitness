export type FuenteMicronutrientes = {
  fibra?: number | null;
  azucares?: number | null;
  sodio?: number | null;
};

export type NutrienteAcumulado = {
  total: number | null;
  conDatos: number;
};

export type ResumenMicronutrientes = {
  totalAlimentos: number;
  fibra: NutrienteAcumulado;
  azucares: NutrienteAcumulado;
  sodio: NutrienteAcumulado;
};

/** Open Food Facts expresa sodio en gramos por 100 g; la UI lo muestra en mg. */
export function sodioGramosAMiligramos(valor: number): number {
  return Math.round(valor * 1000);
}

/**
 * Suma solo valores conocidos. Un cero de la etiqueta es un dato válido; null
 * significa que el fabricante o el catálogo no informó ese nutriente. Así la
 * pantalla nunca presenta un cero engañoso cuando en realidad faltan datos.
 */
export function resumirMicronutrientes(
  alimentos: FuenteMicronutrientes[],
): ResumenMicronutrientes {
  const acumular = (campo: keyof FuenteMicronutrientes): NutrienteAcumulado => {
    let total = 0;
    let conDatos = 0;

    for (const alimento of alimentos) {
      const valor = alimento[campo];
      if (valor === null || valor === undefined || !Number.isFinite(valor)) continue;
      total += valor;
      conDatos += 1;
    }

    return { total: conDatos > 0 ? total : null, conDatos };
  };

  return {
    totalAlimentos: alimentos.length,
    fibra: acumular("fibra"),
    azucares: acumular("azucares"),
    sodio: acumular("sodio"),
  };
}
