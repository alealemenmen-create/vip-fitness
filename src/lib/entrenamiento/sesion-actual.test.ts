import { describe, it, expect } from "vitest";
import { elegirSesionDeHoy, type SesionCandidata } from "./sesion-actual";

const HOY = "2026-08-11";

function sesion(parcial: Partial<SesionCandidata> & { id: string }): SesionCandidata {
  return {
    fecha: HOY,
    estado: "en_progreso",
    rutina_iniciada_en: null,
    rutina_dias: { tipo: "entrenamiento" },
    ...parcial,
  };
}

describe("elegirSesionDeHoy", () => {
  it("el bug del entrenador: con la 6 arrancada y la 7 como vista previa, gana la 6", () => {
    // Orden descendente por numero_calendario, tal como llega de la consulta.
    const sesiones = [
      sesion({ id: "s7" }), // creada por "Ver entrenamiento", nunca iniciada
      sesion({ id: "s6", rutina_iniciada_en: "2026-08-11T10:00:00Z" }),
    ];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s6");
  });

  it("un día de descanso cuenta como en curso sin haber tocado Iniciar rutina", () => {
    const sesiones = [
      sesion({ id: "s8" }),
      sesion({ id: "s7", rutina_dias: { tipo: "descanso" } }),
    ];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s7");
  });

  it("sin ninguna arrancada, sigue mandando la más reciente en progreso", () => {
    const sesiones = [sesion({ id: "s5" }), sesion({ id: "s4" })];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s5");
  });

  it("la última ya cerrada pero de hoy sigue mostrándose", () => {
    const sesiones = [sesion({ id: "s5", estado: "completada" })];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s5");
  });

  it("la última cerrada de otro día no cuenta como entrenamiento de hoy", () => {
    const sesiones = [sesion({ id: "s5", estado: "completada", fecha: "2026-08-09" })];
    expect(elegirSesionDeHoy(sesiones, HOY)).toBeNull();
  });

  it("una sesión vieja arrancada gana sobre una cerrada hoy con número mayor", () => {
    const sesiones = [
      sesion({ id: "s9", estado: "completada" }),
      sesion({ id: "s8", rutina_iniciada_en: "2026-08-10T10:00:00Z", fecha: "2026-08-10" }),
    ];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s8");
  });

  it("con dos arrancadas gana la de número más bajo (la que quedó atrás)", () => {
    const sesiones = [
      sesion({ id: "s7", rutina_iniciada_en: "2026-08-11T12:00:00Z" }),
      sesion({ id: "s6", rutina_iniciada_en: "2026-08-11T10:00:00Z" }),
    ];
    expect(elegirSesionDeHoy(sesiones, HOY)?.id).toBe("s6");
  });

  it("sin sesiones no hay día elegido", () => {
    expect(elegirSesionDeHoy([], HOY)).toBeNull();
  });
});
