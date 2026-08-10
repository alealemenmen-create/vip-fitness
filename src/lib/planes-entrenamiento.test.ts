import { describe, expect, it } from "vitest";
import {
  esCodigoPlanEntrenamiento,
  PLANES_ENTRENAMIENTO,
  resolverPlanEntrenamiento,
} from "./planes-entrenamiento";

describe("planes de entrenamiento VIP", () => {
  it("conserva los cupos y frecuencias comerciales acordados", () => {
    expect(PLANES_ENTRENAMIENTO.access).toMatchObject({ sesionesMensuales: 12, diasSemana: 3 });
    expect(PLANES_ENTRENAMIENTO.select).toMatchObject({ sesionesMensuales: 12, diasSemana: 3, precioCLP: 75_000 });
    expect(PLANES_ENTRENAMIENTO.pro).toMatchObject({ sesionesMensuales: 16, diasSemana: 4, precioCLP: 89_000 });
    expect(PLANES_ENTRENAMIENTO.elite).toMatchObject({ sesionesMensuales: 20, diasSemana: 5, precioCLP: 103_000 });
  });

  it("permite una excepción explícita como Élite de 24 sesiones y 6 días", () => {
    expect(resolverPlanEntrenamiento("elite", 24, 6)).toMatchObject({
      nombre: "Plan Élite",
      sesionesMensuales: 24,
      diasSemana: 6,
    });
  });

  it("rechaza códigos inventados por el cliente", () => {
    expect(esCodigoPlanEntrenamiento("elite")).toBe(true);
    expect(esCodigoPlanEntrenamiento("plan_ilimitado")).toBe(false);
    expect(resolverPlanEntrenamiento("plan_ilimitado")).toBeNull();
  });
});
