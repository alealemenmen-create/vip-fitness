import { describe, expect, it } from "vitest";
import { explicacionTecnica } from "./glosario-tecnicas";

describe("explicacionTecnica", () => {
  it("reconoce drop set sin importar mayúsculas o el espacio", () => {
    expect(explicacionTecnica("Drop set: 50, 30, 20 kg")?.etiqueta).toBe("Drop set");
    expect(explicacionTecnica("dropset en la última serie")?.etiqueta).toBe("Drop set");
  });

  it("prioriza drop set sobre 'descendente' cuando el texto nombra la técnica exacta", () => {
    expect(explicacionTecnica("dropset descendente")?.etiqueta).toBe("Drop set");
  });

  it("reconoce las técnicas encadenadas por nombre de familia", () => {
    expect(explicacionTecnica("Biserie (1/2)")?.etiqueta).toBe("Biserie");
    expect(explicacionTecnica("Triserie de hombro")?.etiqueta).toBe("Triserie");
    expect(explicacionTecnica("Giant Set (2/4)")?.etiqueta).toBe("Giant set");
  });

  it("sin coincidencia conocida, no hay explicación", () => {
    expect(explicacionTecnica("Sube el codo en la bajada")).toBeNull();
    expect(explicacionTecnica(null)).toBeNull();
    expect(explicacionTecnica("")).toBeNull();
  });
});
