import { describe, expect, it } from "vitest";
import { fechaEnVentanaValida, hoyISO, sumarDiasISO } from "./date";

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
