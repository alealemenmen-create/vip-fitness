import { describe, it, expect } from "vitest";
import { sePuedeCorregir } from "./estado-sesion";

describe("sePuedeCorregir", () => {
  it("una sesión cerrada se puede corregir", () => {
    expect(sePuedeCorregir("completada")).toBe(true);
    expect(sePuedeCorregir("finalizada_incompleta")).toBe(true);
  });

  it("una abandonada NO, y por eso el botón tampoco tiene que aparecer", () => {
    // Este es el bug que reportó Alejandro: la pantalla dibujaba el botón con
    // `estado !== 'en_progreso'` y la acción lo rechazaba en silencio.
    expect(sePuedeCorregir("abandonada")).toBe(false);
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
