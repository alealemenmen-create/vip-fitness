import { describe, expect, it } from "vitest";
import { rangoRepsObjetivo } from "./reps";

describe("rangoRepsObjetivo", () => {
  it("extrae min/max de un rango explícito", () => {
    expect(rangoRepsObjetivo("8-12")).toEqual({ min: 8, max: 12 });
    expect(rangoRepsObjetivo("8 – 12")).toEqual({ min: 8, max: 12 });
    expect(rangoRepsObjetivo("8 a 12")).toEqual({ min: 8, max: 12 });
  });

  it("un número fijo da min = max", () => {
    expect(rangoRepsObjetivo("12")).toEqual({ min: 12, max: 12 });
    expect(rangoRepsObjetivo("12 repeticiones")).toEqual({ min: 12, max: 12 });
  });

  it("series descendentes usan el mínimo y el máximo de la lista", () => {
    expect(rangoRepsObjetivo("12/10/8")).toEqual({ min: 8, max: 12 });
  });

  it("devuelve null para texto ambiguo o técnicas que un rango simple no representa", () => {
    expect(rangoRepsObjetivo("al fallo")).toBeNull();
    expect(rangoRepsObjetivo("AMRAP")).toBeNull();
    expect(rangoRepsObjetivo("10 + dropset")).toBeNull();
    expect(rangoRepsObjetivo("8-10 + 5 parciales")).toBeNull();
    expect(rangoRepsObjetivo("rest-pause")).toBeNull();
    expect(rangoRepsObjetivo("myo-reps")).toBeNull();
    expect(rangoRepsObjetivo("cluster 5x3")).toBeNull();
    expect(rangoRepsObjetivo("máximo posible")).toBeNull();
  });

  it("devuelve null para ejercicios de tiempo, no de repeticiones", () => {
    expect(rangoRepsObjetivo("30 seg")).toBeNull();
    expect(rangoRepsObjetivo("45s")).toBeNull();
    expect(rangoRepsObjetivo("2 min")).toBeNull();
  });

  it("devuelve null para texto vacío o ausente", () => {
    expect(rangoRepsObjetivo(null)).toBeNull();
    expect(rangoRepsObjetivo(undefined)).toBeNull();
    expect(rangoRepsObjetivo("")).toBeNull();
  });
});
