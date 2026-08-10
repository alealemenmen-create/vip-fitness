import { describe, expect, it } from "vitest";
import { caloriasDeMacros, reconciliarObjetivos } from "./objetivos";

describe("objetivos de alimentación", () => {
  it("calcula calorías desde los tres macros", () => {
    expect(caloriasDeMacros(199, 110, 80)).toBe(1956);
  });

  it("ajusta carbohidratos para que los macros cierren con la meta", () => {
    const resultado = reconciliarObjetivos({
      kcalObjetivo: 2500,
      protObjetivo: 199,
      carbObjetivo: 110,
      grasaObjetivo: 80,
    });
    expect(resultado.error).toBeNull();
    expect(resultado.ajustado).toBe(true);
    expect(resultado.objetivos.carbObjetivo).toBe(246);
    expect(resultado.kcalCalculadas).toBe(2500);
  });

  it("tolera diferencias pequeñas de redondeo", () => {
    const resultado = reconciliarObjetivos({
      kcalObjetivo: 2000,
      protObjetivo: 150,
      carbObjetivo: 218,
      grasaObjetivo: 60,
    });
    expect(resultado.ajustado).toBe(false);
    expect(resultado.objetivos.carbObjetivo).toBe(218);
  });

  it("bloquea una meta imposible aun con carbohidratos en cero", () => {
    const resultado = reconciliarObjetivos({
      kcalObjetivo: 1000,
      protObjetivo: 200,
      carbObjetivo: 0,
      grasaObjetivo: 30,
    });
    expect(resultado.error).toContain("por encima");
    expect(resultado.ajustado).toBe(false);
  });

  it("no inventa macros cuando faltan proteína o grasa", () => {
    const resultado = reconciliarObjetivos({
      kcalObjetivo: 1800,
      protObjetivo: null,
      carbObjetivo: null,
      grasaObjetivo: null,
    });
    expect(resultado.error).toBeNull();
    expect(resultado.ajustado).toBe(false);
  });
});
