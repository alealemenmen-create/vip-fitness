import { describe, expect, it } from "vitest";
import { debeEliminarComidaVacia } from "./limpiezaComida";

describe("debeEliminarComidaVacia", () => {
  it("elimina el contenedor cuando ya no quedan alimentos", () => {
    expect(debeEliminarComidaVacia({ alimentosRestantes: 0, omitida: false, observacion: null })).toBe(true);
  });

  it("conserva una comida que todavía tiene alimentos", () => {
    expect(debeEliminarComidaVacia({ alimentosRestantes: 1, omitida: false, observacion: null })).toBe(false);
  });

  it("conserva observaciones y comidas omitidas aunque no tengan alimentos", () => {
    expect(debeEliminarComidaVacia({ alimentosRestantes: 0, omitida: false, observacion: "Sin apetito" })).toBe(false);
    expect(debeEliminarComidaVacia({ alimentosRestantes: 0, omitida: true, observacion: null })).toBe(false);
  });
});
