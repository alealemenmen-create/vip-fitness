import { describe, expect, it } from "vitest";
import { bloquesPermanecenUnidos, cargasSonComparables, sustitucionEsCompatible, validarConjuntoOrdenado } from "./personalizacion-sesion";

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
    const origen = { id: "sentadilla", grupoMuscular: "piernas", categoria: "pierna", patronMovimiento: "sentadilla", equipo: "smith", activo: true, fichaCompleta: true };
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", patronMovimiento: "sentadilla", equipo: "maquina", activo: true, fichaCompleta: true })).toBe(true);
    expect(sustitucionEsCompatible(origen, { id: "peso-muerto", grupoMuscular: "piernas", categoria: "pierna", patronMovimiento: "bisagra", equipo: "barra", activo: true, fichaCompleta: true })).toBe(false);
    expect(sustitucionEsCompatible(origen, { id: "remo", grupoMuscular: "espalda", categoria: "traccion", activo: true, fichaCompleta: true })).toBe(false);
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", activo: false, fichaCompleta: true })).toBe(false);
    expect(sustitucionEsCompatible(origen, { id: "hack", grupoMuscular: "piernas", categoria: "pierna", activo: true, fichaCompleta: false })).toBe(false);
  });

  it("exige el mismo patrón de movimiento cuando el origen ya lo tiene clasificado, aunque compartan grupo y categoría", () => {
    const abductor = { id: "abductor", grupoMuscular: "piernas", categoria: "aislamiento", patronMovimiento: "pierna_abduccion", activo: true, fichaCompleta: true };
    // Mismo grupo_muscular y categoría que el abductor, pero es el músculo opuesto (aductor) — antes se ofrecía igual.
    expect(sustitucionEsCompatible(abductor, { id: "aductor", grupoMuscular: "piernas", categoria: "aislamiento", patronMovimiento: "pierna_aduccion", activo: true, fichaCompleta: true })).toBe(false);
    // Sin patron_movimiento clasificado todavía en el sustituto: no se puede confirmar que sea el mismo ángulo, se descarta.
    expect(sustitucionEsCompatible(abductor, { id: "sin-clasificar", grupoMuscular: "piernas", categoria: "aislamiento", activo: true, fichaCompleta: true })).toBe(false);
    // Si el ORIGEN todavía no está clasificado, sigue la comparación laxa de antes (no se rompe nada mientras se completa la biblioteca).
    const sinClasificar = { id: "sin-clasificar", grupoMuscular: "piernas", categoria: "aislamiento", activo: true, fichaCompleta: true };
    expect(sustitucionEsCompatible(sinClasificar, { id: "aductor", grupoMuscular: "piernas", categoria: "aislamiento", patronMovimiento: "pierna_aduccion", activo: true, fichaCompleta: true })).toBe(true);
  });

  it("no compara cargas entre implementos distintos aunque el reemplazo sea válido", () => {
    const base = { id: "press-smith", grupoMuscular: "pecho", categoria: "empuje", patronMovimiento: "empuje_horizontal", equipo: "smith", activo: true, fichaCompleta: true };
    expect(cargasSonComparables(base, { ...base, id: "otro-smith" })).toBe(true);
    expect(cargasSonComparables(base, { ...base, id: "press-mancuernas", equipo: "mancuerna" })).toBe(false);
  });
});
