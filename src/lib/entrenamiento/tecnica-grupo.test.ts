import { describe, expect, it } from "vitest";
import { construirBloquesTecnica, posicionTecnica, resolverGrupoTecnica, tamanoGrupoTecnica } from "./tecnica-grupo";

describe("resolverGrupoTecnica", () => {
  it("reconoce cada familia sin importar mayúsculas ni el sufijo (n/total)", () => {
    expect(resolverGrupoTecnica("Biserie (1/2)")?.etiqueta).toBe("Biserie");
    expect(resolverGrupoTecnica("SUPERSERIE")?.etiqueta).toBe("Superserie");
    expect(resolverGrupoTecnica("triserie de hombro")?.etiqueta).toBe("Triserie");
    expect(resolverGrupoTecnica("Giant Set (1/4)")?.etiqueta).toBe("Giant Set");
    expect(resolverGrupoTecnica("Circuito metabólico")?.etiqueta).toBe("Circuito");
  });

  it("reconoce finalizador, complejo con barra, AMRAP y EMOM — bug real: alumna con 'Finalizador (1/3)' salía como 3 ejercicios sueltos en vez de un grupo", () => {
    expect(resolverGrupoTecnica("Finalizador (1/3)")?.etiqueta).toBe("Finalizador");
    expect(resolverGrupoTecnica("Complejo con barra (2/4)")?.etiqueta).toBe("Complejo");
    expect(resolverGrupoTecnica("AMRAP 5 minutos (1/3)")?.etiqueta).toBe("AMRAP");
    expect(resolverGrupoTecnica("EMOM (3/4)")?.etiqueta).toBe("EMOM");
  });

  it("sin tecnicaTipo o sin familia conocida, no hay grupo", () => {
    expect(resolverGrupoTecnica(null)).toBeNull();
    expect(resolverGrupoTecnica("")).toBeNull();
    expect(resolverGrupoTecnica("Rest-pause")).toBeNull();
    // "Finisher" es una técnica de UN solo ejercicio (no encadena varios,
    // nunca trae sufijo n/total) — no confundir con "Finalizador".
    expect(resolverGrupoTecnica("Finisher")).toBeNull();
    expect(resolverGrupoTecnica("Finisher oclusivo")).toBeNull();
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

describe("construirBloquesTecnica — bug real: un circuito sin numerar se reordenaba ejercicio por ejercicio", () => {
  it("agrupa un circuito de 4 ejercicios SIN sufijo (n/total) en un solo bloque, no en 4 sueltos", () => {
    const ejercicios = [
      { sesionEjercicioId: "a", tecnicaTipo: "Circuito metabólico" },
      { sesionEjercicioId: "b", tecnicaTipo: "Circuito metabólico" },
      { sesionEjercicioId: "c", tecnicaTipo: "Circuito metabólico" },
      { sesionEjercicioId: "d", tecnicaTipo: "Circuito metabólico" },
    ];
    const bloques = construirBloquesTecnica(ejercicios);
    const idsDeBloque = new Set(ejercicios.map((e) => bloques.get(e.sesionEjercicioId)));
    // Las 4 filas comparten el mismo id de bloque -- exactamente lo que
    // `bloquesPermanecenUnidos` necesita para exigir que se muevan juntas.
    expect(idsDeBloque.size).toBe(1);
    expect(bloques.get("a")).toBeDefined();
  });

  it("una serie gigante sin numerar seguida de un ejercicio suelto no se mezcla con él", () => {
    const ejercicios = [
      { sesionEjercicioId: "a", tecnicaTipo: "Giant Set" },
      { sesionEjercicioId: "b", tecnicaTipo: "Giant Set" },
      { sesionEjercicioId: "c", tecnicaTipo: "Giant Set" },
      { sesionEjercicioId: "suelto", tecnicaTipo: null },
    ];
    const bloques = construirBloquesTecnica(ejercicios);
    expect(bloques.get("a")).toBe(bloques.get("b"));
    expect(bloques.get("b")).toBe(bloques.get("c"));
    // El ejercicio suelto (sin técnica encadenada) no entra a ningún bloque.
    expect(bloques.has("suelto")).toBe(false);
  });

  it("dos biseries numeradas seguidas siguen separándose en dos bloques de 2, no uno de 4", () => {
    const ejercicios = [
      { sesionEjercicioId: "a1", tecnicaTipo: "Biserie (1/2)" },
      { sesionEjercicioId: "a2", tecnicaTipo: "Biserie (2/2)" },
      { sesionEjercicioId: "b1", tecnicaTipo: "Biserie (1/2)" },
      { sesionEjercicioId: "b2", tecnicaTipo: "Biserie (2/2)" },
    ];
    const bloques = construirBloquesTecnica(ejercicios);
    expect(bloques.get("a1")).toBe(bloques.get("a2"));
    expect(bloques.get("b1")).toBe(bloques.get("b2"));
    expect(bloques.get("a1")).not.toBe(bloques.get("b1"));
  });
});
