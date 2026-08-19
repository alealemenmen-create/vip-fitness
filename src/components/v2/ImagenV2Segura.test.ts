import { describe, expect, it } from "vitest";
import { fuentesImagenV2 } from "./ImagenV2Segura";

describe("fuentesImagenV2", () => {
  it("mantiene el orden principal, respaldo y último recurso local", () => {
    expect(fuentesImagenV2("https://cdn.test/rota.webp", "/ejercicios/sentadilla.webp"))
      .toEqual(["https://cdn.test/rota.webp", "/ejercicios/sentadilla.webp", "/v2/piernas.webp"]);
  });

  it("elimina duplicados y valores vacíos", () => {
    expect(fuentesImagenV2("/v2/piernas.webp", "/v2/piernas.webp"))
      .toEqual(["/v2/piernas.webp"]);
  });
});
