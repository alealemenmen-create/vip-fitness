import { describe, expect, it } from "vitest";
import { errorMetasNutricionales } from "./metasNutricionales";

describe("errorMetasNutricionales", () => {
  it("acepta calorías positivas y macros no negativos", () => {
    expect(errorMetasNutricionales({ kcal: 2846, prot: 232, carb: 239, grasa: 106 })).toBeNull();
    expect(errorMetasNutricionales({ kcal: 1, prot: 0, carb: null, grasa: 0 })).toBeNull();
  });

  it("explica cuando faltan las calorías", () => {
    expect(errorMetasNutricionales({ kcal: null, prot: 100, carb: 100, grasa: 50 }))
      .toBe("Falta la meta de calorías.");
  });

  it("rechaza cero calorías antes de llegar a la base", () => {
    expect(errorMetasNutricionales({ kcal: 0, prot: 100, carb: 100, grasa: 50 }))
      .toBe("La meta de calorías debe ser mayor que cero.");
  });

  it("rechaza macros negativos", () => {
    expect(errorMetasNutricionales({ kcal: 2000, prot: -1, carb: 100, grasa: 50 }))
      .toContain("no pueden ser negativas");
  });
});
