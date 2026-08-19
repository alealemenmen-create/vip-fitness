import { describe, expect, it } from "vitest";
import { validarSeguimientoDiario } from "./validar";

function formulario(valores: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(valores)) datos.set(campo, valor);
  return datos;
}

describe("validarSeguimientoDiario", () => {
  it("conserva preguntas sin responder como null", () => {
    const resultado = validarSeguimientoDiario(formulario({ entreno_hoy: "", energia: "" }));
    expect(resultado).toEqual(expect.objectContaining({
      ok: true,
      datos: expect.objectContaining({ entreno_hoy: null, energia: null }),
    }));
  });

  it("acepta coma decimal y respuestas válidas", () => {
    const resultado = validarSeguimientoDiario(formulario({
      entreno_hoy: "true",
      cumplio_alimentacion: "false",
      agua_litros: "2,5",
      horas_sueno: "7.5",
      energia: "4",
    }));
    expect(resultado).toEqual(expect.objectContaining({
      ok: true,
      datos: expect.objectContaining({
        entreno_hoy: true,
        cumplio_alimentacion: false,
        agua_litros: 2.5,
        horas_sueno: 7.5,
        energia: 4,
      }),
    }));
  });

  it("rechaza rangos imposibles y energía decimal", () => {
    expect(validarSeguimientoDiario(formulario({ horas_sueno: "27" })).ok).toBe(false);
    expect(validarSeguimientoDiario(formulario({ energia: "3.5" })).ok).toBe(false);
  });
});
