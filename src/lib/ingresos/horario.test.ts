import { describe, expect, it } from "vitest";
import { calcularHorarioHabitual } from "./horario";

describe("calcularHorarioHabitual", () => {
  it("no adivina una hora con menos de tres entrenamientos", () => {
    expect(calcularHorarioHabitual(["2026-08-10T16:00:00Z", "2026-08-11T16:15:00Z"])).toEqual({
      hora: null,
      confianza: null,
      muestras: 2,
    });
  });

  it("usa la mediana y resiste una hora excepcional", () => {
    const resultado = calcularHorarioHabitual([
      "2026-08-01T16:00:00Z",
      "2026-08-02T16:10:00Z",
      "2026-08-03T16:15:00Z",
      "2026-08-04T16:20:00Z",
      "2026-08-05T16:30:00Z",
      "2026-08-06T23:30:00Z",
    ]);
    expect(resultado.hora).toBe("12:20");
    expect(resultado.confianza).toBe("alta");
    expect(resultado.muestras).toBe(6);
  });
});
