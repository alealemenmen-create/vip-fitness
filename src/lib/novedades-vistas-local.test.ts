import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  leerNovedadesVistasHasta,
  marcarNovedadesVistasHasta,
  contarNovedadesSinVer,
} from "./novedades-vistas-local";

/** localStorage mínimo: vitest corre en node, no en el navegador. */
function montarAlmacenamiento() {
  const datos = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  });
  return datos;
}

describe("novedades vistas local", () => {
  beforeEach(() => {
    montarAlmacenamiento();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin nada guardado, nunca se vio nada", () => {
    expect(leerNovedadesVistasHasta()).toBeNull();
  });

  it("guarda y devuelve la fecha marcada", () => {
    marcarNovedadesVistasHasta("2026-08-10T12:00:00Z");
    expect(leerNovedadesVistasHasta()).toBe("2026-08-10T12:00:00Z");
  });

  it("sin nada visto todavía, todas las novedades cuentan como sin ver", () => {
    expect(contarNovedadesSinVer(["2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z"])).toBe(2);
  });

  it("cuenta solo las más nuevas que lo último visto", () => {
    marcarNovedadesVistasHasta("2026-08-05T00:00:00Z");
    expect(
      contarNovedadesSinVer(["2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z", "2026-08-10T00:00:00Z"])
    ).toBe(1);
  });

  it("al día, no hay ninguna sin ver", () => {
    marcarNovedadesVistasHasta("2026-08-10T00:00:00Z");
    expect(contarNovedadesSinVer(["2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z"])).toBe(0);
  });
});
