import { describe, expect, it } from "vitest";
import { evaluarDisponibilidadIntervencion } from "./resolucion-intervencion";

describe("evaluarDisponibilidadIntervencion", () => {
  it.each(["preparada", "mostrada"] as const)("permite resolver una intervención %s", (estado) => {
    const intervencion = { estado, verificacion: null };
    expect(evaluarDisponibilidadIntervencion(intervencion)).toEqual({ puedeResolver: true, intervencion });
  });

  it("trata como éxito idempotente un resultado declarado ya guardado", () => {
    expect(evaluarDisponibilidadIntervencion({ estado: "resuelta", verificacion: "declarada" })).toEqual({
      puedeResolver: false,
      resultado: { error: null, ok: true, verificada: false },
    });
  });

  it("conserva la verificación por datos en un reintento", () => {
    expect(evaluarDisponibilidadIntervencion({ estado: "resuelta", verificacion: "datos" })).toEqual({
      puedeResolver: false,
      resultado: { error: null, ok: true, verificada: true },
    });
  });

  it.each([
    null,
    { estado: "cancelada" as const, verificacion: null },
  ])("rechaza una intervención inexistente o cancelada", (intervencion) => {
    expect(evaluarDisponibilidadIntervencion(intervencion)).toEqual({
      puedeResolver: false,
      resultado: {
        error: "Esta intervencion ya no esta disponible.",
        ok: false,
        verificada: false,
      },
    });
  });
});
