import { describe, expect, it } from "vitest";
import { diaAnteriorISO, puedeRegistrarComidaEnFecha } from "./ventanaRegistro";

describe("ventana de registro de comidas", () => {
  it("calcula ayer en cambios de mes y de año sin depender del dispositivo", () => {
    expect(diaAnteriorISO("2026-08-01")).toBe("2026-07-31");
    expect(diaAnteriorISO("2026-01-01")).toBe("2025-12-31");
    expect(diaAnteriorISO("fecha-invalida")).toBeNull();
  });

  it("permite crear solamente hoy o ayer", () => {
    expect(puedeRegistrarComidaEnFecha({ fecha: "2026-08-19", fechaHoy: "2026-08-19" })).toBe(true);
    expect(puedeRegistrarComidaEnFecha({ fecha: "2026-08-18", fechaHoy: "2026-08-19" })).toBe(true);
    expect(puedeRegistrarComidaEnFecha({ fecha: "2026-08-20", fechaHoy: "2026-08-19" })).toBe(false);
    expect(puedeRegistrarComidaEnFecha({ fecha: "2026-08-17", fechaHoy: "2026-08-19" })).toBe(false);
  });

  it("permite continuar un diario anterior que ya existe", () => {
    expect(puedeRegistrarComidaEnFecha({
      fecha: "2026-08-16",
      fechaHoy: "2026-08-19",
      fechasConRegistro: ["2026-08-16"],
    })).toBe(true);
  });
});
