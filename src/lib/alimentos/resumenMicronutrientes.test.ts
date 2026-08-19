import { describe, expect, it } from "vitest";
import { resumirMicronutrientes, sodioGramosAMiligramos } from "./resumenMicronutrientes";

describe("resumirMicronutrientes", () => {
  it("distingue un nutriente no informado de un cero real", () => {
    const resumen = resumirMicronutrientes([
      { fibra: null, azucares: 0, sodio: 15 },
      { fibra: undefined, azucares: null, sodio: 25 },
    ]);

    expect(resumen.totalAlimentos).toBe(2);
    expect(resumen.fibra).toEqual({ total: null, conDatos: 0 });
    expect(resumen.azucares).toEqual({ total: 0, conDatos: 1 });
    expect(resumen.sodio).toEqual({ total: 40, conDatos: 2 });
  });

  it("suma valores conocidos y contabiliza la cobertura por nutriente", () => {
    const resumen = resumirMicronutrientes([
      { fibra: 3.5, azucares: 8, sodio: 120 },
      { fibra: 2, azucares: null, sodio: 80 },
      { fibra: null, azucares: 4, sodio: null },
    ]);

    expect(resumen.fibra).toEqual({ total: 5.5, conDatos: 2 });
    expect(resumen.azucares).toEqual({ total: 12, conDatos: 2 });
    expect(resumen.sodio).toEqual({ total: 200, conDatos: 2 });
  });

  it("mantiene el resumen vacío cuando todavía no hay alimentos", () => {
    expect(resumirMicronutrientes([])).toEqual({
      totalAlimentos: 0,
      fibra: { total: null, conDatos: 0 },
      azucares: { total: null, conDatos: 0 },
      sodio: { total: null, conDatos: 0 },
    });
  });

  it("convierte el sodio almacenado en gramos a miligramos para mostrarlo", () => {
    expect(sodioGramosAMiligramos(0.1)).toBe(100);
    expect(sodioGramosAMiligramos(0.075)).toBe(75);
  });
});
