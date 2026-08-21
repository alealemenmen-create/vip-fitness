import { describe, expect, it } from "vitest";
import { nombreCortoRutina } from "./nombre-rutina";

describe("nombreCortoRutina", () => {
  it("saca el sufijo (copia) y acorta los días", () => {
    expect(nombreCortoRutina("HIPERTROFIA 5 DÍAS (copia)")).toBe("HIPERTROFIA 5D");
  });

  it("acorta días sin (copia)", () => {
    expect(nombreCortoRutina("Fuerza 3 días")).toBe("Fuerza 3D");
  });

  it("deja intacto un nombre sin días ni (copia)", () => {
    expect(nombreCortoRutina("Full body express")).toBe("Full body express");
  });

  it("no toca (copia) si no está al final", () => {
    expect(nombreCortoRutina("(copia) de hipertrofia")).toBe("(copia) de hipertrofia");
  });
});
