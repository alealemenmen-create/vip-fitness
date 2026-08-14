import { describe, expect, it } from "vitest";
import { calcularPuntosAlimentacion, limitarTramosDescanso, PUNTOS_VIP } from "./reglas";

describe("puntos de alimentación", () => {
  it("mantiene el puntaje histórico cuando no existe meta de proteína", () => {
    expect(calcularPuntosAlimentacion(2000, 2000, true)).toBe(PUNTOS_VIP.alimentacionMaximo);
  });

  it("reserva parte del puntaje para la proteína cuando la meta existe", () => {
    expect(calcularPuntosAlimentacion(2000, 2000, true, 0, 150)).toBe(200);
    expect(calcularPuntosAlimentacion(2000, 2000, true, 150, 150)).toBe(250);
  });

  it("no premia proteína por encima de la meta más de una vez", () => {
    expect(calcularPuntosAlimentacion(2000, 2000, true, 300, 150)).toBe(250);
  });

  it("la penalización por un día sin registros iguala el piso de quien registra mal", () => {
    expect(calcularPuntosAlimentacion(0, 2000, true, 0, 150)).toBe(-100);
  });
});

describe("descansos", () => {
  it("limita valores absurdos al máximo realmente penalizable", () => {
    expect(limitarTramosDescanso(209)).toBe(10);
    expect(limitarTramosDescanso(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
