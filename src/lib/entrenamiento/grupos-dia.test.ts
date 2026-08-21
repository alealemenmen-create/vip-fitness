import { describe, expect, it } from "vitest";
import { cardioIdentificaElDia, gruposIdentificadoresDia } from "./grupos-dia";

describe("gruposIdentificadoresDia", () => {
  it("saca cardio cuando es solo calentamiento (1 de 7)", () => {
    const grupos = gruposIdentificadoresDia(["cardio", "espalda", "espalda", "pecho", "pecho", "pecho", "brazos"]);
    expect(grupos).toEqual(["espalda", "pecho", "brazos"]);
  });

  it("deja cardio si es literalmente el único tipo del día", () => {
    expect(gruposIdentificadoresDia(["cardio", "cardio"])).toEqual(["cardio"]);
  });

  it("deja cardio si alcanza el umbral aunque haya otros grupos", () => {
    const grupos = gruposIdentificadoresDia(["cardio", "cardio", "cardio", "espalda"]);
    expect(grupos).toEqual(["cardio", "espalda"]);
  });

  it("ignora nulos y mantiene el orden de primera aparición", () => {
    expect(gruposIdentificadoresDia([null, "pecho", null, "hombros", "pecho"])).toEqual(["pecho", "hombros"]);
  });
});

describe("cardioIdentificaElDia", () => {
  it("false con lista vacía", () => {
    expect(cardioIdentificaElDia([])).toBe(false);
  });

  it("false con 2 de cardio mezclado con musculación", () => {
    expect(cardioIdentificaElDia(["cardio", "cardio", "espalda", "pecho", "brazos"])).toBe(false);
  });

  it("true con 3 de cardio mezclado con musculación", () => {
    expect(cardioIdentificaElDia(["cardio", "cardio", "cardio", "espalda"])).toBe(true);
  });
});
