import { describe, expect, it } from "vitest";
import { calcularDuracionSesionSegundos } from "./duracion-sesion";

describe("calcularDuracionSesionSegundos", () => {
  it("conserva la duración exacta de una sesión cerrada", () => {
    expect(calcularDuracionSesionSegundos("2026-08-19T12:00:00Z", "2026-08-19T12:01:35Z")).toBe(95);
  });

  it("no inventa tiempo con fechas ausentes, inválidas o invertidas", () => {
    expect(calcularDuracionSesionSegundos(null, "2026-08-19T12:01:35Z")).toBe(0);
    expect(calcularDuracionSesionSegundos("fecha-invalida", "2026-08-19T12:01:35Z")).toBe(0);
    expect(calcularDuracionSesionSegundos("2026-08-19T12:02:00Z", "2026-08-19T12:01:35Z")).toBe(0);
  });
});
