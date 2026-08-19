import { describe, expect, it } from "vitest";
import { validarRegistroPeso, validarSeguimientoDiario } from "./validar";

function formulario(valores: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(valores)) datos.set(campo, valor);
  return datos;
}

describe("validarSeguimientoDiario", () => {
  it("conserva preguntas sin responder como null", () => {
    const resultado = validarSeguimientoDiario(formulario({ entreno_hoy: "", energia: "", horas_sueno: "7" }));
    expect(resultado).toEqual(expect.objectContaining({
      ok: true,
      datos: expect.objectContaining({ entreno_hoy: null, energia: null }),
    }));
  });

  it("no crea adherencia con un check-in completamente vacío", () => {
    expect(validarSeguimientoDiario(formulario({}))).toEqual({
      ok: false,
      error: "Completa al menos una señal de tu check-in antes de guardar.",
    });
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

  it("rechaza texto excedido en vez de guardarlo cortado silenciosamente", () => {
    expect(validarSeguimientoDiario(formulario({ comentario: "x".repeat(601) }))).toEqual({
      ok: false,
      error: "El comentario no puede superar 600 caracteres.",
    });
  });
});

describe("validarRegistroPeso", () => {
  it("acepta coma decimal y conserva dos decimales", () => {
    expect(validarRegistroPeso(formulario({ peso_kg: "88,235", observacion: "  En ayunas  " }))).toEqual({
      ok: true,
      datos: { pesoKg: 88.24, observacion: "En ayunas" },
    });
  });

  it("rechaza valores imposibles y observaciones que se perderían truncadas", () => {
    expect(validarRegistroPeso(formulario({ peso_kg: "501" })).ok).toBe(false);
    expect(validarRegistroPeso(formulario({ peso_kg: "80", observacion: "x".repeat(301) }))).toEqual({
      ok: false,
      error: "La observación no puede superar 300 caracteres.",
    });
  });
});
