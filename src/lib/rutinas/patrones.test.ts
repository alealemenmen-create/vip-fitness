import { describe, expect, it } from "vitest";
import { patronMovimiento } from "./patrones";

describe("patronMovimiento por grupo muscular explícito", () => {
  it("reconoce tríceps aunque el nombre no repita la palabra tríceps", () => {
    expect(patronMovimiento("Extensión en polea", "Tríceps")).toBe("triceps_polea_abajo");
    expect(patronMovimiento("Extensión sobre la cabeza", "TRICEPS")).toBe("triceps_sobre_cabeza");
  });

  it("reconoce bíceps aunque el nombre sea una variante corta", () => {
    expect(patronMovimiento("Flexión con barra", "Bíceps")).toBe("biceps_supinado");
    expect(patronMovimiento("Martillo alternado", "BICEPS")).toBe("biceps_neutro");
  });

  it("no confunde el curl femoral con un ejercicio de bíceps", () => {
    expect(patronMovimiento("Curl femoral", "piernas")).toBe("pierna_flexion_rodilla");
  });
});
