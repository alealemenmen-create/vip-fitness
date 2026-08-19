import { describe, expect, it } from "vitest";
import { resumirPesosDiarios } from "./progreso-v2";

describe("resumirPesosDiarios", () => {
  it("usa la corrección más reciente del día y calcula sólo dentro del período", () => {
    const resumen = resumirPesosDiarios([
      { id: "fuera", fecha: "2026-07-01", pesoKg: 99, createdAt: "2026-07-01T10:00:00Z" },
      { id: "a", fecha: "2026-08-01", pesoKg: 90, createdAt: "2026-08-01T08:00:00Z" },
      { id: "corregido", fecha: "2026-08-01", pesoKg: 89.5, createdAt: "2026-08-01T09:00:00Z" },
      { id: "b", fecha: "2026-08-19", pesoKg: 88.2, createdAt: "2026-08-19T08:00:00Z" },
    ], "2026-08-01", "2026-08-19");

    expect(resumen.historialDiario.map((registro) => registro.id)).toEqual(["fuera", "corregido", "b"]);
    expect(resumen.ultimo?.id).toBe("b");
    expect(resumen.variacionPeriodo).toBe(-1.3);
  });

  it("no inventa variación con un solo registro del período", () => {
    expect(resumirPesosDiarios([
      { fecha: "2026-08-19", pesoKg: 88.2 },
    ], "2026-07-21", "2026-08-19").variacionPeriodo).toBeNull();
  });
});
