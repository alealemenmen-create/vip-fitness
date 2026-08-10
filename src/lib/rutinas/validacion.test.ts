import { describe, expect, it } from "vitest";
import { detectarDeficienciasRutina } from "./validacion";

describe("validación crítica de rutinas", () => {
  it("bloquea un día de pecho compuesto solo por aperturas y cruces", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Pecho + Bíceps", ejercicios: [
      { nombre: "Aperturas con mancuernas", series: 4, grupoMuscular: "pecho" },
      { nombre: "Aperturas inclinadas", series: 4, grupoMuscular: "pecho" },
      { nombre: "Cruces en polea", series: 4, grupoMuscular: "pecho" },
    ] }]);
    expect(errores.join(" ")).toContain("sin ningún press");
  });

  it("bloquea espalda con dos jalones equivalentes pero sin remo", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Pecho + Espalda", ejercicios: [
      { nombre: "Jalón al pecho agarre cerrado", series: 4, grupoMuscular: "espalda" },
      { nombre: "Jalón al pecho agarre neutro", series: 4, grupoMuscular: "espalda" },
      { nombre: "Hiperextensiones", series: 3, grupoMuscular: "espalda" },
    ] }]);
    expect(errores.join(" ")).toContain("remo");
  });

  it("reconoce overhead y sobre la cabeza como el mismo patrón de tríceps", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Espalda + Tríceps", ejercicios: [
      { nombre: "Extensión de tríceps sobre la cabeza", series: 3, grupoMuscular: "brazos" },
      { nombre: "Extensión de tríceps overhead con cuerda", series: 3, grupoMuscular: "brazos" },
    ] }]);
    expect(errores.join(" ")).toContain("mismo patrón");
  });

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
