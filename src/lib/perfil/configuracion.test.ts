import { describe, expect, it } from "vitest";
import { SEGUNDOS_DESCANSO_PERMITIDOS, segundosDescansoPermitidos, validarDatosPersonales } from "./configuracion";

const base = {
  nombre: "  Alejandra   Mendoza ",
  fechaNacimiento: "1990-05-10",
  estaturaCm: "170,5",
  condicionMedica: " Ninguna ",
  restriccionAlimenticia: " Sin alergias ",
  telefono: "+56 9 1234 5678",
  sexo: "femenino",
};

describe("validarDatosPersonales", () => {
  it("normaliza una ficha válida antes de enviarla a la base", () => {
    expect(validarDatosPersonales(base, new Date(2026, 7, 19))).toEqual({
      ok: true,
      datos: {
        nombre: "Alejandra Mendoza",
        fechaNacimiento: "1990-05-10",
        estaturaCm: 170.5,
        condicionMedica: "Ninguna",
        restriccionAlimenticia: "Sin alergias",
        telefono: "+56 9 1234 5678",
        sexo: "femenino",
      },
    });
  });

  it("rechaza fechas imposibles y futuras", () => {
    expect(validarDatosPersonales({ ...base, fechaNacimiento: "2026-02-31" }, new Date(2026, 7, 19))).toEqual({ ok: false, error: "Ingresa una fecha de nacimiento válida." });
    expect(validarDatosPersonales({ ...base, fechaNacimiento: "2026-08-20" }, new Date(2026, 7, 19))).toEqual({ ok: false, error: "La fecha de nacimiento no puede estar en el futuro." });
  });

  it("rechaza NaN y estaturas fuera del rango que muestra la interfaz", () => {
    expect(validarDatosPersonales({ ...base, estaturaCm: "hola" }).ok).toBe(false);
    expect(validarDatosPersonales({ ...base, estaturaCm: "79" }).ok).toBe(false);
    expect(validarDatosPersonales({ ...base, estaturaCm: "261" }).ok).toBe(false);
  });

  it("limita textos sensibles y datos de contacto", () => {
    expect(validarDatosPersonales({ ...base, condicionMedica: "x".repeat(2001) }).ok).toBe(false);
    expect(validarDatosPersonales({ ...base, telefono: "teléfono inventado" }).ok).toBe(false);
  });
});

describe("segundosDescansoPermitidos", () => {
  it("coincide con la restricción instalada en alumno_perfil", () => {
    expect(SEGUNDOS_DESCANSO_PERMITIDOS).toEqual([40, 60, 90, 120, 150]);
    for (const segundos of SEGUNDOS_DESCANSO_PERMITIDOS) expect(segundosDescansoPermitidos(segundos)).toBe(true);
    expect(segundosDescansoPermitidos(null)).toBe(true);
    expect(segundosDescansoPermitidos(45)).toBe(false);
  });
});
