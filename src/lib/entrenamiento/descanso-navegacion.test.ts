import { describe, expect, it } from "vitest";
import { claveDescansoSesion, destinoAlAvanzarSerieCompletada } from "./descanso-navegacion";

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

  it("avanza directamente cuando el temporizador está apagado o el bloque no descansa", () => {
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: false,
      requiereDescanso: true,
      descansoYaResuelto: false,
    })).toBe("siguiente");
    expect(destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico: true,
      requiereDescanso: false,
      descansoYaResuelto: false,
    })).toBe("siguiente");
  });
});
