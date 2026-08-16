import { describe, expect, it } from "vitest";
import {
  fechaEnSemanaActualValida,
  fechaEnVentanaValida,
  fechaPasadaValida,
  hoyISO,
  lunesDeISO,
  sumarDiasISO,
} from "./date";

describe("fechaEnVentanaValida", () => {
  it("acepta hoy y ayer", () => {
    expect(fechaEnVentanaValida(hoyISO())).toBe(true);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -1))).toBe(true);
  });

  it("rechaza cualquier fecha más atrás que ayer", () => {
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -2))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -30))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -365))).toBe(false);
  });

  it("rechaza fechas futuras", () => {
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), 30))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaEnVentanaValida("")).toBe(false);
    expect(fechaEnVentanaValida("no es una fecha")).toBe(false);
    expect(fechaEnVentanaValida("2026-8-5")).toBe(false);
    expect(fechaEnVentanaValida("05-08-2026")).toBe(false);
  });
});

describe("fechaPasadaValida", () => {
  it("acepta hoy y fechas viejas — es la fecha real de una foto de antes", () => {
    expect(fechaPasadaValida(hoyISO())).toBe(true);
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -30))).toBe(true);
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -700))).toBe(true);
  });

  it("rechaza el futuro", () => {
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
  });

  it("rechaza lo absurdamente viejo", () => {
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -365 * 11))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaPasadaValida("")).toBe(false);
    expect(fechaPasadaValida("2026-8-5")).toBe(false);
  });
});

describe("lunesDeISO", () => {
  it("un lunes es lunes de sí mismo", () => {
    // 2026-08-10 es lunes.
    expect(lunesDeISO("2026-08-10")).toBe("2026-08-10");
  });

  it("cualquier día de la semana cae en el mismo lunes", () => {
    expect(lunesDeISO("2026-08-11")).toBe("2026-08-10"); // martes
    expect(lunesDeISO("2026-08-14")).toBe("2026-08-10"); // viernes
    expect(lunesDeISO("2026-08-16")).toBe("2026-08-10"); // domingo
  });

  it("cruza de mes correctamente", () => {
    // 2026-08-31 es lunes; el domingo siguiente cae en septiembre.
    expect(lunesDeISO("2026-08-31")).toBe("2026-08-31");
    expect(lunesDeISO("2026-09-06")).toBe("2026-08-31");
    expect(lunesDeISO("2026-09-07")).toBe("2026-09-07");
  });
});

describe("fechaEnSemanaActualValida", () => {
  it("acepta cualquier día de la semana en curso, incluido hoy", () => {
    const lunesActual = lunesDeISO(hoyISO());
    expect(fechaEnSemanaActualValida(hoyISO())).toBe(true);
    expect(fechaEnSemanaActualValida(lunesActual)).toBe(true);
  });

  it("rechaza la semana pasada, aunque sea de hace un día", () => {
    const lunesActual = lunesDeISO(hoyISO());
    const domingoPasado = sumarDiasISO(lunesActual, -1);
    expect(fechaEnSemanaActualValida(domingoPasado)).toBe(false);
  });

  it("rechaza el futuro", () => {
    expect(fechaEnSemanaActualValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaEnSemanaActualValida("")).toBe(false);
    expect(fechaEnSemanaActualValida("2026-8-5")).toBe(false);
  });
});
