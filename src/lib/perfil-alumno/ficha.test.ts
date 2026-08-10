import { describe, expect, it } from "vitest";
import { camposFaltantes, fichaCompleta, FICHA_VACIA, type FichaAlumno } from "./ficha";

const completa: FichaAlumno = {
  ...FICHA_VACIA,
  fechaNacimiento: "1990-05-10",
  sexo: "femenino",
  objetivoPrincipal: "hipertrofia",
  diasDisponibles: 4,
  minutosSesion: 60,
  experiencia: "intermedio",
  completadoEn: "2026-08-09T12:00:00.000Z",
};

describe("fichaCompleta", () => {
  it("una ficha con todo lo que el generador necesita pasa", () => {
    expect(fichaCompleta(completa)).toBe(true);
    expect(camposFaltantes(completa)).toEqual([]);
  });

  it("una ficha vacía no pasa y dice todo lo que falta", () => {
    expect(fichaCompleta(FICHA_VACIA)).toBe(false);
    expect(camposFaltantes(FICHA_VACIA)).toContain("fecha de nacimiento");
    expect(camposFaltantes(FICHA_VACIA)).toContain("objetivo");
  });

  it("sin fecha de nacimiento no pasa: sin edad no hay ajuste de volumen", () => {
    expect(fichaCompleta({ ...completa, fechaNacimiento: null })).toBe(false);
  });

  it("sin sexo no pasa: es lo que define el énfasis del motor", () => {
    expect(fichaCompleta({ ...completa, sexo: null })).toBe(false);
  });

  it("sin experiencia no pasa: el motor caería en principiante por defecto", () => {
    expect(fichaCompleta({ ...completa, experiencia: null })).toBe(false);
  });

  it("no basta con los datos: hay que haber contestado la parte de salud", () => {
    expect(fichaCompleta({ ...completa, completadoEn: null })).toBe(false);
    expect(camposFaltantes({ ...completa, completadoEn: null })).toContain("confirmación de los datos de salud");
  });

  it("no tener molestias ni lesiones es una ficha válida: contestó que no", () => {
    expect(fichaCompleta({ ...completa, molestias: null, lesionesDiagnosticadas: null })).toBe(true);
  });

  it("los datos opcionales no bloquean el ingreso", () => {
    expect(fichaCompleta({ ...completa, estaturaCm: null, telefono: null, objetivoSecundario: null })).toBe(true);
  });
});
