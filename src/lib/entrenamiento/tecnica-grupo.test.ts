import { describe, expect, it } from "vitest";
import { posicionTecnica, resolverGrupoTecnica, tamanoGrupoTecnica } from "./tecnica-grupo";

describe("resolverGrupoTecnica", () => {
  it("reconoce cada familia sin importar mayúsculas ni el sufijo (n/total)", () => {
    expect(resolverGrupoTecnica("Biserie (1/2)")?.etiqueta).toBe("Biserie");
    expect(resolverGrupoTecnica("SUPERSERIE")?.etiqueta).toBe("Superserie");
    expect(resolverGrupoTecnica("triserie de hombro")?.etiqueta).toBe("Triserie");
    expect(resolverGrupoTecnica("Giant Set (1/4)")?.etiqueta).toBe("Giant Set");
    expect(resolverGrupoTecnica("Circuito metabólico")?.etiqueta).toBe("Circuito");
  });

  it("sin tecnicaTipo o sin familia conocida, no hay grupo", () => {
    expect(resolverGrupoTecnica(null)).toBeNull();
    expect(resolverGrupoTecnica("")).toBeNull();
    expect(resolverGrupoTecnica("Rest-pause")).toBeNull();
  });
});

describe("posicionTecnica", () => {
  it("lee el número explícito", () => {
    expect(posicionTecnica("Biserie (2/2)")).toEqual({ actual: 2, total: 2 });
  });

  it("sin el sufijo, no hay posición", () => {
    expect(posicionTecnica("Biserie")).toBeNull();
  });
});

describe("tamanoGrupoTecnica — el bug reportado: biserias sin numerar se fundían con la siguiente", () => {
  it("con el número explícito, manda ese número", () => {
    expect(tamanoGrupoTecnica("Triserie (1/3)")).toBe(3);
  });

  it("Biserie sin numerar cae al default de la familia: 2", () => {
    expect(tamanoGrupoTecnica("Biserie")).toBe(2);
  });

  it("Superserie sin numerar cae al default de la familia: 2", () => {
    expect(tamanoGrupoTecnica("Superserie")).toBe(2);
  });

  it("Triserie sin numerar cae al default de la familia: 3", () => {
    expect(tamanoGrupoTecnica("Triserie")).toBe(3);
  });

  it("Giant Set y Circuito sin numerar quedan sin tope: varían de verdad", () => {
    expect(tamanoGrupoTecnica("Giant Set")).toBeNull();
    expect(tamanoGrupoTecnica("Circuito metabólico")).toBeNull();
  });

  it("sin tecnicaTipo, sin tamaño", () => {
    expect(tamanoGrupoTecnica(null)).toBeNull();
  });
});
