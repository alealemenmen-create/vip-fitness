import { describe, expect, it } from "vitest";
import { propuestaRequiereRevision } from "./propuestas-data";

describe("propuestaRequiereRevision", () => {
  it("deja que un cierre seguro se active solo", () => {
    expect(propuestaRequiereRevision({ tipo: "cierre_controlado", prescripcion: {} })).toBe(false);
  });

  it("manda técnicas intensas y supervisadas a la excepción", () => {
    expect(propuestaRequiereRevision({ tipo: "drop_set", prescripcion: {} })).toBe(true);
    expect(propuestaRequiereRevision({ tipo: "tempo_controlado", prescripcion: { requiereSupervision: true } })).toBe(true);
  });
});
