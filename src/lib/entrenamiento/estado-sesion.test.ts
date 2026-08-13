import { describe, it, expect } from "vitest";
import { sePuedeCorregir } from "./estado-sesion";

describe("sePuedeCorregir", () => {
  it("una sesión cerrada se puede corregir", () => {
    expect(sePuedeCorregir("completada")).toBe(true);
    expect(sePuedeCorregir("finalizada_incompleta")).toBe(true);
  });

  it("una abandonada también: se abandona por error más seguido de lo que parece", () => {
    // Decisión expresa de Alejandro. Reabrirla NO devuelve los puntos que
    // `abandonarSesion` retiró — se corrige lo registrado, no la recompensa.
    expect(sePuedeCorregir("abandonada")).toBe(true);
  });

  it("una en progreso no se corrige: se sigue editando y ya", () => {
    expect(sePuedeCorregir("en_progreso")).toBe(false);
  });

  it("no se cae con un estado ausente o desconocido", () => {
    expect(sePuedeCorregir(null)).toBe(false);
    expect(sePuedeCorregir(undefined)).toBe(false);
    expect(sePuedeCorregir("")).toBe(false);
    expect(sePuedeCorregir("inventado")).toBe(false);
  });
});
