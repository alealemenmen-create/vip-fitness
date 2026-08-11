import { describe, expect, it } from "vitest";
import type { DiaSemanaV2 } from "@/lib/generador-rutinas-v2/constructor-semanal";
import {
  compararRutinasV2,
  nombreRutinaVersionadaV2,
  type RutinaActivaComparacionV2,
  type RutinaPublicableV2,
} from "@/lib/generador-rutinas-v2/publicacion";

function dias(): DiaSemanaV2[] {
  return [{
    numero: 1,
    nombre: "Superior",
    enfoque: ["pecho"],
    seriesDirectas: 7,
    minutosEstimados: 30,
    ejercicios: [
      { orden: 1, ejercicioId: "press", nombre: "Press", grupoDosis: "pecho", patron: "pecho_press_horizontal", series: 3, repeticiones: "8–12", rir: "2–3", descansoSegundos: 90, motivo: "Base", sustituciones: [] },
      { orden: 2, ejercicioId: "apertura", nombre: "Apertura", grupoDosis: "pecho", patron: "pecho_aislamiento", series: 4, repeticiones: "10–15", rir: "1–2", descansoSegundos: 60, motivo: "Accesorio", sustituciones: [] },
    ],
  }];
}

const propuesta: RutinaPublicableV2 = { version: 1, nombreRutina: "Plan", dias: dias() };

describe("Publicación Versionada VIP 2.0", () => {
  it("resume una primera versión sin inventar una rutina anterior", () => {
    const comparacion = compararRutinasV2(null, propuesta, 1);
    expect(comparacion.esPrimeraVersion).toBe(true);
    expect(comparacion.resumenActivo).toEqual({ dias: 0, ejercicios: 0, series: 0 });
    expect(comparacion.resumenPropuesto).toEqual({ dias: 1, ejercicios: 2, series: 7 });
  });

  it("muestra altas, retiros y dosis total contra la versión activa", () => {
    const activa: RutinaActivaComparacionV2 = {
      id: "anterior",
      nombre: "Plan anterior",
      version: 2,
      createdAt: "2026-08-01T00:00:00.000Z",
      dias: [{ numero: 1, nombre: "Superior", ejercicios: [
        { ejercicioId: "press", nombre: "Press", series: 2 },
        { ejercicioId: "remo", nombre: "Remo", series: 3 },
      ] }],
    };

    const comparacion = compararRutinasV2(activa, propuesta, 3);
    expect(comparacion.esPrimeraVersion).toBe(false);
    expect(comparacion.resumenActivo.series).toBe(5);
    expect(comparacion.ejerciciosAgregados).toEqual(["Apertura"]);
    expect(comparacion.ejerciciosRetirados).toEqual(["Remo"]);
  });

  it("construye un nombre trazable y legible", () => {
    expect(nombreRutinaVersionadaV2("Ana", "perdida_grasa", 4)).toBe("Plan Perdida grasa — Ana — v4");
  });
});
