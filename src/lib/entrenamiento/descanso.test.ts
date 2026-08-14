import { describe, expect, it } from "vitest";
import { descansoPausadoTermino } from "./descanso";

/**
 * Regresión del 14/08 (biserie de Cristian Muñoz): un descanso pausado porque
 * otra serie tomó el turno no cerraba nunca su ciclo, así que la tarjeta
 * seguía pidiendo series "faltantes" que el alumno ya había hecho y guardado.
 */
describe("descansoPausadoTermino", () => {
  const ahora = 1_000_000;

  it("sigue pendiente mientras falte tiempo", () => {
    expect(descansoPausadoTermino(ahora + 30_000, ahora)).toBe(false);
  });

  it("termina justo al cumplirse la hora de fin", () => {
    expect(descansoPausadoTermino(ahora, ahora)).toBe(true);
  });

  it("termina si la hora de fin ya pasó", () => {
    expect(descansoPausadoTermino(ahora - 1, ahora)).toBe(true);
  });

  it("sin hora de fin guardada, no deja la serie pendiente para siempre", () => {
    expect(descansoPausadoTermino(null, ahora)).toBe(true);
  });
});
