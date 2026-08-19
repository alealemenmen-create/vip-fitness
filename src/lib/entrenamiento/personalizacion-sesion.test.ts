import { describe, expect, it } from "vitest";
import { bloquesPermanecenUnidos, sustitucionEsCompatible, validarConjuntoOrdenado } from "./personalizacion-sesion";

describe("personalización segura de una sesión", () => {
  it("acepta el mismo conjunto en otro orden", () => {
    expect(validarConjuntoOrdenado(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("rechaza duplicados, elementos ajenos y omisiones", () => {
    expect(validarConjuntoOrdenado(["a", "b"], ["a", "a"])).toBe(false);
    expect(validarConjuntoOrdenado(["a", "b"], ["a", "c"])).toBe(false);
    expect(validarConjuntoOrdenado(["a", "b"], ["a"])).toBe(false);
  });

  it("mantiene una biserie contigua y en su orden interno", () => {
    const bloques = [["b1", "b2"]];
    expect(bloquesPermanecenUnidos(["a", "b1", "b2", "c"], bloques)).toBe(true);
    expect(bloquesPermanecenUnidos(["b1", "b2", "a", "c"], bloques)).toBe(true);
    expect(bloquesPermanecenUnidos(["b2", "b1", "a", "c"], bloques)).toBe(false);
    expect(bloquesPermanecenUnidos(["b1", "a", "b2", "c"], bloques)).toBe(false);
  });

  it("sólo permite reemplazos activos, aprobados y biomecánicamente compatibles", () => {
    const origen = { id: "sentadilla", grupoMuscular: "piernas", categoria: "pierna", activo: true, fichaCompleta: true };
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", activo: true, fichaCompleta: true })).toBe(true);
    expect(sustitucionEsCompatible(origen, { id: "remo", grupoMuscular: "espalda", categoria: "traccion", activo: true, fichaCompleta: true })).toBe(false);
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", activo: false, fichaCompleta: true })).toBe(false);
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", activo: true, fichaCompleta: false })).toBe(false);
  });
});
