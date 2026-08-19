import { describe, expect, it } from "vitest";
import { evaluarPreparacionDiariaAlejandro, limitarMomentosPorPreparacion } from "./preparacion-diaria";

const BASE = {
  entreno_hoy: null,
  cumplio_alimentacion: null,
  agua_litros: null,
  horas_sueno: 8,
  energia: 4,
  molestias: null,
  comentario: null,
};

describe("preparación diaria de Alejandro", () => {
  it("es conservadora sin check-in y deja como máximo un reto", () => {
    const preparacion = evaluarPreparacionDiariaAlejandro(null);
    expect(preparacion.estado).toBe("sin_checkin");
    expect(limitarMomentosPorPreparacion([1, 2, 3], preparacion)).toEqual([1]);
  });

  it("pausa retos extra ante molestia o recuperación crítica", () => {
    expect(evaluarPreparacionDiariaAlejandro({ ...BASE, molestias: "rodilla" }).maximoMomentos).toBe(0);
    expect(evaluarPreparacionDiariaAlejandro({ ...BASE, horas_sueno: 4.5 }).maximoMomentos).toBe(0);
    expect(evaluarPreparacionDiariaAlejandro({ ...BASE, energia: 2 }).maximoMomentos).toBe(0);
  });

  it("limita una señal intermedia y conserva una preparación estable", () => {
    expect(evaluarPreparacionDiariaAlejandro({ ...BASE, energia: 3 }).maximoMomentos).toBe(1);
    expect(evaluarPreparacionDiariaAlejandro(BASE).maximoMomentos).toBeNull();
  });
});
