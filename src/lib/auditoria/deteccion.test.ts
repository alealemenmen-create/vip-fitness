import { describe, expect, it } from "vitest";
import { esDuracionImposible } from "./deteccion";

describe("esDuracionImposible", () => {
  it("no marca sesiones con menos del mínimo de series aunque la duración sea 0", () => {
    expect(esDuracionImposible(0, 5)).toBe(false);
  });

  it("marca una sesión de 8 series resuelta en 30 segundos", () => {
    expect(esDuracionImposible(30, 8)).toBe(true);
  });

  it("no marca una sesión de 8 series que duró 20 minutos", () => {
    expect(esDuracionImposible(1200, 8)).toBe(false);
  });
});
