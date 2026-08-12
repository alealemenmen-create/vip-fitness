import { describe, it, expect } from "vitest";
import {
  etiquetaSeriesTecnica,
  normalizarTecnicaSeries,
  seriesLimpiasParaProgresion,
  tecnicaAplicaASerie,
} from "./tecnica-series";

describe("normalizarTecnicaSeries", () => {
  it("deja null como null: es 'todas las series', no 'ninguna'", () => {
    expect(normalizarTecnicaSeries(null, 4)).toBeNull();
    expect(normalizarTecnicaSeries(undefined, 4)).toBeNull();
  });

  it("ordena, deduplica y descarta lo que está fuera del rango real", () => {
    expect(normalizarTecnicaSeries([4, 2, 4], 4)).toEqual([2, 4]);
    // Marcó la 5 y después bajó el ejercicio a 3 series: se cae la 5 en vez de
    // reventar contra el CHECK de la migración al guardar.
    expect(normalizarTecnicaSeries([2, 5], 3)).toEqual([2]);
    expect(normalizarTecnicaSeries([0, -1, 1.5], 4)).toBeNull();
  });

  it("marcarlas todas es lo mismo que no marcar ninguna", () => {
    expect(normalizarTecnicaSeries([1, 2, 3, 4], 4)).toBeNull();
    expect(normalizarTecnicaSeries([], 4)).toBeNull();
  });
});

describe("tecnicaAplicaASerie", () => {
  it("con null corre en todas: es el comportamiento anterior a la 0073", () => {
    expect(tecnicaAplicaASerie(null, 1)).toBe(true);
    expect(tecnicaAplicaASerie(null, 4)).toBe(true);
  });

  it("con series marcadas, solo en esas", () => {
    expect(tecnicaAplicaASerie([4], 4)).toBe(true);
    expect(tecnicaAplicaASerie([4], 3)).toBe(false);
  });
});

describe("etiquetaSeriesTecnica", () => {
  it("nombra el caso normal por lo que es, no por su número", () => {
    expect(etiquetaSeriesTecnica([4], 4)).toBe("última serie");
    expect(etiquetaSeriesTecnica([2], 4)).toBe("serie 2");
    expect(etiquetaSeriesTecnica(null, 4)).toBe("todas las series");
    expect(etiquetaSeriesTecnica([2, 4], 4)).toBe("series 2 y 4");
    expect(etiquetaSeriesTecnica([1, 2, 3], 4)).toBe("series 1, 2 y 3");
  });
});

describe("seriesLimpiasParaProgresion", () => {
  it("drop set en la última serie: las tres anteriores sirven", () => {
    expect(seriesLimpiasParaProgresion([4], 4)).toEqual([1, 2, 3]);
  });

  it("técnica en todo el ejercicio: se excluye entero, como siempre", () => {
    // También cubre las encadenadas (superserie, biserie, circuito, giant
    // set): ahí `tecnicaSeries` es siempre null.
    expect(seriesLimpiasParaProgresion(null, 4)).toBeNull();
  });

  it("técnica en la serie 1 o 2: las siguientes arrastran esa fatiga y no sirven", () => {
    expect(seriesLimpiasParaProgresion([1], 4)).toBeNull();
    expect(seriesLimpiasParaProgresion([2], 4)).toBeNull();
    // Aunque la 1 y la 2 estén limpias, la 4 viene después de la 3.
    expect(seriesLimpiasParaProgresion([3], 4)).toBeNull();
  });

  it("las dos últimas con técnica todavía dejan dos limpias", () => {
    expect(seriesLimpiasParaProgresion([3, 4], 4)).toEqual([1, 2]);
  });

  it("menos de dos series limpias es ruido, no una tendencia", () => {
    expect(seriesLimpiasParaProgresion([2, 3], 3)).toBeNull();
    expect(seriesLimpiasParaProgresion([2, 3, 4], 4)).toBeNull();
  });
});
