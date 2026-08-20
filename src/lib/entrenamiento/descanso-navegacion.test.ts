import { describe, expect, it } from "vitest";
import {
  ajustarFinDescanso,
  claveDescansoSesion,
  destinoAlAvanzarSerieCompletada,
  segundosRestantesDescanso,
} from "./descanso-navegacion";

describe("navegación de descansos de la sesión V2", () => {
  it("identifica cada descanso por ejercicio y serie", () => {
    expect(claveDescansoSesion("peso-muerto", 1)).toBe("peso-muerto-1");
  });

  it("abre el descanso la primera vez que una serie lo requiere", () => {
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: true,
      requiereDescanso: true,
      descansoYaResuelto: false,
    })).toBe("descanso");
  });

  it("no repite un descanso al volver a una serie ya recorrida", () => {
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: true,
      requiereDescanso: true,
      descansoYaResuelto: true,
    })).toBe("siguiente");
  });

  it("mantiene el descanso como referencia cuando el temporizador está apagado", () => {
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: false,
      requiereDescanso: true,
      descansoYaResuelto: false,
    })).toBe("descanso");
  });

  it("avanza directamente cuando el bloque no requiere descanso", () => {
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: true,
      requiereDescanso: false,
      descansoYaResuelto: false,
    })).toBe("siguiente");
  });

  it("recupera el tiempo real después de que el navegador estuvo suspendido", () => {
    const inicio = 1_000_000;
    const finEn = inicio + 90_000;

    expect(segundosRestantesDescanso(finEn, inicio)).toBe(90);
    expect(segundosRestantesDescanso(finEn, inicio + 63_400)).toBe(27);
    expect(segundosRestantesDescanso(finEn, inicio + 100_000)).toBe(0);
  });

  it("ajusta el descanso desde el tiempo real y respeta los límites", () => {
    const ahora = 1_000_000;
    const finEn = ahora + 60_000;

    expect(ajustarFinDescanso({ finEn, cambioSegundos: 15, ahora }))
      .toEqual({ segundos: 75, finEn: ahora + 75_000 });
    expect(ajustarFinDescanso({ finEn, cambioSegundos: -90, ahora }))
      .toEqual({ segundos: 0, finEn: ahora });
    expect(ajustarFinDescanso({ finEn, cambioSegundos: 2_000, ahora }))
      .toEqual({ segundos: 900, finEn: ahora + 900_000 });
  });
});
