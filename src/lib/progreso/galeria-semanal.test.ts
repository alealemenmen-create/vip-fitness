import { describe, expect, it } from "vitest";
import { construirGaleriaSemanal, type FotoSemanaInput } from "./galeria-semanal";

function foto(id: string, fechaFoto: string, fechaCarga = `${fechaFoto}T12:00:00Z`): FotoSemanaInput {
  return { id, fechaFoto, fechaCarga, url: `url-${id}`, storagePath: `path-${id}` };
}

describe("construirGaleriaSemanal", () => {
  it("sin fotos, devuelve solo la semana actual, vacía", () => {
    const semanas = construirGaleriaSemanal([], "2026-08-16");
    expect(semanas).toEqual([
      { lunes: "2026-08-10", domingo: "2026-08-16", esActual: true, foto: null },
    ]);
  });

  it("rellena las semanas sin foto entre la primera y la actual", () => {
    // Foto en la semana del 27 jul (lunes 27-07). Hoy: 16-08 (semana del 10-08).
    const semanas = construirGaleriaSemanal([foto("a", "2026-07-28")], "2026-08-16");
    expect(semanas.map((s) => s.lunes)).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
    ]);
    expect(semanas[0].foto?.id).toBe("a");
    expect(semanas[1].foto).toBeNull();
    expect(semanas[2].foto).toBeNull();
    expect(semanas[2].esActual).toBe(true);
    expect(semanas[0].esActual).toBe(false);
  });

  it("con dos fotos en la misma semana (datos de antes de la regla), gana la de fechaCarga más reciente", () => {
    const vieja = foto("vieja", "2026-08-11", "2026-08-11T09:00:00Z");
    const nueva = foto("nueva", "2026-08-12", "2026-08-12T09:00:00Z");
    const semanas = construirGaleriaSemanal([vieja, nueva], "2026-08-16");
    const semanaDeAgosto10 = semanas.find((s) => s.lunes === "2026-08-10");
    expect(semanaDeAgosto10?.foto?.id).toBe("nueva");
  });

  it("una foto por semana, cada una en su propia entrada", () => {
    const semanas = construirGaleriaSemanal(
      [foto("s1", "2026-08-03"), foto("s2", "2026-08-10")],
      "2026-08-16"
    );
    expect(semanas.map((s) => s.foto?.id)).toEqual(["s1", "s2"]);
  });
});
