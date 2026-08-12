import { describe, expect, it } from "vitest";
import { seriesSugeridasPorSesion } from "./ArmarRutinaPanel";

describe("series por grupo muscular según nivel", () => {
  it("aplica la dosis solicitada para principiante", () => {
    expect(seriesSugeridasPorSesion("principiante", 1)).toEqual([5]);
    expect(seriesSugeridasPorSesion("principiante", 2)).toEqual([3, 3]);
    expect(seriesSugeridasPorSesion("principiante", 3)).toEqual([3, 2, 2]);
  });

  it("progresa hasta avanzado y Olympia", () => {
    expect(seriesSugeridasPorSesion("intermedio", 3)).toEqual([4, 3, 3]);
    expect(seriesSugeridasPorSesion("avanzado", 3)).toEqual([6, 6, 6]);
    expect(seriesSugeridasPorSesion("olympia", 3)).toEqual([8, 8, 8]);
  });
});
