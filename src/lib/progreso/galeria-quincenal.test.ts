import { describe, expect, it } from "vitest";
import { construirGaleriaQuincenal, type FotoGaleriaInput } from "./galeria-quincenal";

function foto(id: string, fechaFoto: string, fechaCarga = `${fechaFoto}T12:00:00Z`): FotoGaleriaInput {
  return { id, fechaFoto, fechaCarga, url: `url-${id}`, storagePath: `path-${id}` };
}

describe("construirGaleriaQuincenal", () => {
  it("sin fotos, devuelve solo la quincena actual, vacía", () => {
    const quincenas = construirGaleriaQuincenal([], "2026-08-16");
    expect(quincenas).toEqual([
      { inicio: "2026-08-16", fin: "2026-08-31", esActual: true, foto: null },
    ]);
  });

  it("rellena las quincenas sin foto entre la primera y la actual", () => {
    // Foto del 20 de julio cae en la quincena 16-31 de julio. Hoy: 16-08
    // (quincena 16-31 de agosto).
    const quincenas = construirGaleriaQuincenal([foto("a", "2026-07-20")], "2026-08-16");
    expect(quincenas.map((q) => q.inicio)).toEqual([
      "2026-07-16",
      "2026-08-01",
      "2026-08-16",
    ]);
    expect(quincenas[0].foto?.id).toBe("a");
    expect(quincenas[1].foto).toBeNull();
    expect(quincenas[2].foto).toBeNull();
    expect(quincenas[2].esActual).toBe(true);
    expect(quincenas[0].esActual).toBe(false);
  });

  it("con dos fotos en la misma quincena (datos de antes de la regla), gana la de fechaCarga más reciente", () => {
    const vieja = foto("vieja", "2026-08-17", "2026-08-17T09:00:00Z");
    const nueva = foto("nueva", "2026-08-20", "2026-08-20T09:00:00Z");
    const quincenas = construirGaleriaQuincenal([vieja, nueva], "2026-08-31");
    const quincenaDe16 = quincenas.find((q) => q.inicio === "2026-08-16");
    expect(quincenaDe16?.foto?.id).toBe("nueva");
  });

  it("una foto por quincena, cada una en su propia entrada", () => {
    const quincenas = construirGaleriaQuincenal(
      [foto("q1", "2026-08-01"), foto("q2", "2026-08-16")],
      "2026-08-16"
    );
    expect(quincenas.map((q) => q.foto?.id)).toEqual(["q1", "q2"]);
  });

  it("cruza de mes correctamente", () => {
    const quincenas = construirGaleriaQuincenal([foto("a", "2026-07-05")], "2026-08-05");
    expect(quincenas.map((q) => q.inicio)).toEqual([
      "2026-07-01",
      "2026-07-16",
      "2026-08-01",
    ]);
  });
});
