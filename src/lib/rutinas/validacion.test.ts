import { describe, expect, it } from "vitest";
import { detectarDeficienciasRutina } from "./validacion";

describe("validación crítica de rutinas", () => {
  it("impide una semana de brazos con cuatro curls y un solo tríceps", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Brazos", ejercicios: [
      { nombre: "Curl barra", series: 4, grupoMuscular: "brazos" },
      { nombre: "Curl martillo", series: 4, grupoMuscular: "brazos" },
      { nombre: "Curl predicador", series: 4, grupoMuscular: "brazos" },
      { nombre: "Curl polea", series: 4, grupoMuscular: "brazos" },
      { nombre: "Extensión de tríceps", series: 4, grupoMuscular: "brazos" },
    ] }]);
    expect(errores.join(" ")).toContain("desbalanceado");
  });

  it("acepta una distribución equilibrada de brazos", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Brazos", ejercicios: [
      { nombre: "Curl barra", series: 3, grupoMuscular: "brazos" },
      { nombre: "Curl martillo", series: 3, grupoMuscular: "brazos" },
      { nombre: "Extensión de tríceps", series: 3, grupoMuscular: "brazos" },
      { nombre: "Press francés", series: 3, grupoMuscular: "brazos" },
    ] }]);
    expect(errores).toEqual([]);
  });

  it("bloquea días inflados", () => {
    const ejercicios = Array.from({ length: 11 }, (_, i) => ({ nombre: `Ejercicio ${i}`, series: 3, grupoMuscular: "pecho" }));
    expect(detectarDeficienciasRutina([{ nombre: "Pecho", ejercicios }])[0]).toContain("máximo seguro");
  });

  it("no bloquea un bloque intensivo de piernas que sigue siendo plausible", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Piernas", ejercicios: [
      { nombre: "Sentadilla", series: 12, grupoMuscular: "piernas" },
      { nombre: "Prensa", series: 12, grupoMuscular: "piernas" },
      { nombre: "Extensión", series: 12, grupoMuscular: "piernas" },
    ] }]);
    expect(errores).toEqual([]);
  });
});
