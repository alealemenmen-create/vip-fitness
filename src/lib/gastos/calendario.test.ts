import { describe, expect, it } from "vitest";
import { estadoVencimiento, siguienteFechaPago } from "./calendario";

describe("calendario de gastos", () => {
  it("avisa dentro de la anticipación configurada", () => {
    expect(estadoVencimiento("2026-08-15", 3, "2026-08-12")).toEqual({ estado: "proximo", dias: 3 });
    expect(estadoVencimiento("2026-08-16", 3, "2026-08-12").estado).toBe("al_dia");
  });

  it("distingue pago de hoy y vencido", () => {
    expect(estadoVencimiento("2026-08-12", 3, "2026-08-12").estado).toBe("hoy");
    expect(estadoVencimiento("2026-08-10", 3, "2026-08-12")).toEqual({ estado: "vencido", dias: -2 });
  });

  it("mueve un mensual preservando el día cuando existe", () => {
    expect(siguienteFechaPago("2026-08-31", "mensual", "2026-08-31")).toBe("2026-09-30");
  });

  it("salta vencimientos antiguos hasta quedar en el futuro", () => {
    expect(siguienteFechaPago("2026-05-08", "mensual", "2026-08-12")).toBe("2026-09-08");
    expect(siguienteFechaPago("2025-07-01", "anual", "2026-08-12")).toBe("2027-07-01");
  });

  it("los gastos variables y únicos no inventan otra fecha", () => {
    expect(siguienteFechaPago("2026-08-12", "variable", "2026-08-12")).toBeNull();
    expect(siguienteFechaPago("2026-08-12", "unico", "2026-08-12")).toBeNull();
  });
});
