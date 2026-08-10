import { describe, expect, it } from "vitest";
import { adherenciaPonderada, cumplimientoMinimo, nivelDeCumplimiento, precisionObjetivo, promedio } from "./calculos";

describe("cálculos de seguimiento", () => {
  it("no confunde exceso calórico con cumplimiento perfecto", () => {
    expect(precisionObjetivo(2500, 2000)).toBe(75);
    expect(precisionObjetivo(1500, 2000)).toBe(75);
  });

  it("proteína cumple al llegar a la meta y no supera 100", () => {
    expect(cumplimientoMinimo(160, 160)).toBe(100);
    expect(cumplimientoMinimo(200, 160)).toBe(100);
  });

  it("renormaliza cuando un área no tiene objetivo", () => {
    expect(adherenciaPonderada([{ valor: 80, peso: 45 }, { valor: null, peso: 40 }, { valor: 100, peso: 15 }])).toBe(85);
  });

  it("clasifica con lenguaje no castigador", () => {
    expect(nivelDeCumplimiento(92)).toBe("excelente");
    expect(nivelDeCumplimiento(82)).toBe("muy_bien");
    expect(nivelDeCumplimiento(70)).toBe("en_proceso");
    expect(nivelDeCumplimiento(50)).toBe("atencion");
  });

  it("promedia solo datos reales", () => {
    expect(promedio([null, 2, 4])).toBe(3);
    expect(promedio([null])).toBeNull();
  });
});
