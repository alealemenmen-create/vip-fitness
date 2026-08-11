import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { guardarAsistenteArmado, leerAsistenteArmado, limpiarAsistenteArmado } from "./asistente-armado-local";

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

const ESTADO = { seleccionando: false, nivel: "intermedio", dias: 4 };

describe("asistente de armado local", () => {
  let datos: Map<string, string>;
  beforeEach(() => {
    datos = montarAlmacenamiento();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("guarda y devuelve lo guardado", () => {
    guardarAsistenteArmado(ESTADO);
    expect(leerAsistenteArmado<typeof ESTADO>()).toEqual(ESTADO);
  });

  it("sin nada guardado, no hay nada que retomar", () => {
    expect(leerAsistenteArmado()).toBeNull();
  });

  it("descarta un asistente de más de un día — se restaura solo, sin preguntar, así que conviene ser conservador", () => {
    const ahora = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    guardarAsistenteArmado(ESTADO);
    vi.setSystemTime(ahora + 25 * 60 * 60 * 1000);
    expect(leerAsistenteArmado()).toBeNull();
    expect(datos.size).toBe(0);
  });

  it("dentro de las 24 horas, se sigue restaurando", () => {
    const ahora = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    guardarAsistenteArmado(ESTADO);
    vi.setSystemTime(ahora + 23 * 60 * 60 * 1000);
    expect(leerAsistenteArmado<typeof ESTADO>()).toEqual(ESTADO);
  });

  it("limpiar deja la pizarra vacía — es lo que corre al reiniciar el asistente", () => {
    guardarAsistenteArmado(ESTADO);
    limpiarAsistenteArmado();
    expect(leerAsistenteArmado()).toBeNull();
  });

  it("sobrevive a un valor corrupto sin romper la pantalla", () => {
    datos.set("vip:asistente-armado", "{no es json");
    expect(leerAsistenteArmado()).toBeNull();
  });

  it("un objeto guardado sin la clave `estado` (formato viejo o corrupto) no rompe la lectura", () => {
    datos.set("vip:asistente-armado", JSON.stringify({ guardadoEn: Date.now() }));
    expect(leerAsistenteArmado()).toBeNull();
  });
});
