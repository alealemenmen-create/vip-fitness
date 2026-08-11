import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  guardarBorradorArmado,
  leerBorradorArmado,
  limpiarBorradorArmado,
  haceCuanto,
} from "./borrador-local";

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

const RUTINA = { nombreRutina: "Pecho pesado", dias: [] };

describe("borrador local del armado", () => {
  let datos: Map<string, string>;
  beforeEach(() => {
    datos = montarAlmacenamiento();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("guarda y devuelve lo guardado", () => {
    guardarBorradorArmado(["a1"], RUTINA, 12);
    const leido = leerBorradorArmado<typeof RUTINA>(["a1"]);
    expect(leido?.rutina.nombreRutina).toBe("Pecho pesado");
    expect(leido?.ejercicios).toBe(12);
  });

  it("la clave no depende del orden en que se marcaron los alumnos", () => {
    guardarBorradorArmado(["b", "a"], RUTINA, 3);
    expect(leerBorradorArmado(["a", "b"])).not.toBeNull();
    expect(datos.size).toBe(1);
  });

  it("no mezcla el borrador de un alumno con el de otro", () => {
    guardarBorradorArmado(["a1"], RUTINA, 3);
    expect(leerBorradorArmado(["a2"])).toBeNull();
  });

  it("sin alumnos no guarda ni lee nada", () => {
    guardarBorradorArmado([], RUTINA, 3);
    expect(datos.size).toBe(0);
    expect(leerBorradorArmado([])).toBeNull();
  });

  it("descarta un borrador vencido y lo borra del almacenamiento", () => {
    const ahora = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    guardarBorradorArmado(["a1"], RUTINA, 3);
    vi.setSystemTime(ahora + 4 * 24 * 60 * 60 * 1000);
    expect(leerBorradorArmado(["a1"])).toBeNull();
    expect(datos.size).toBe(0);
  });

  it("limpiar deja la pizarra vacía — es lo que corre al publicar", () => {
    guardarBorradorArmado(["a1"], RUTINA, 3);
    limpiarBorradorArmado(["a1"]);
    expect(leerBorradorArmado(["a1"])).toBeNull();
  });

  it("sobrevive a un valor corrupto sin romper la pantalla", () => {
    datos.set("vip:armado:a1", "{no es json");
    expect(leerBorradorArmado(["a1"])).toBeNull();
  });
});

describe("haceCuanto", () => {
  const AHORA = 1_800_000_000_000;
  it("dice el tiempo en criollo", () => {
    expect(haceCuanto(AHORA, AHORA)).toBe("recién");
    expect(haceCuanto(AHORA - 60_000, AHORA)).toBe("hace 1 minuto");
    expect(haceCuanto(AHORA - 25 * 60_000, AHORA)).toBe("hace 25 minutos");
    expect(haceCuanto(AHORA - 3 * 3_600_000, AHORA)).toBe("hace 3 horas");
    expect(haceCuanto(AHORA - 2 * 86_400_000, AHORA)).toBe("hace 2 días");
  });
});
