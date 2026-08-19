import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { responderConHistorialLocal, type ContextoAlumnoVip } from "./alumno";

function contextoConSesiones(
  sesionesRecientes: ContextoAlumnoVip["sesionesRecientes"]
): ContextoAlumnoVip {
  return {
    recordatorios: [],
    sesionesRecientes,
    marcasRecientes: [],
    progreso: { pesoActual: null, fechaPeso: null, ultimaFoto: null },
  };
}

describe("responderConHistorialLocal", () => {
  it("distingue una sesión completada de una finalizada parcialmente", () => {
    const respuesta = responderConHistorialLocal(
      "¿Qué entrené recientemente?",
      contextoConSesiones([
        { fecha: "2026-08-19", dia: "Piernas", estado: "finalizada_incompleta" },
        { fecha: "2026-08-18", dia: "Torso", estado: "completada" },
      ])
    );

    expect(respuesta).toContain("Piernas (finalizada parcialmente)");
    expect(respuesta).toContain("Torso (completada)");
  });

  it("no presenta una sesión parcial como completa aunque su nombre lo sugiera", () => {
    const respuesta = responderConHistorialLocal(
      "historial de entrenamientos",
      contextoConSesiones([
        { fecha: "2026-08-19", dia: "Entrenamiento QA completo", estado: "finalizada_incompleta" },
      ])
    );

    expect(respuesta).toBe(
      "Tus entrenamientos más recientes fueron: 2026-08-19: Entrenamiento QA completo (finalizada parcialmente)."
    );
  });
});
