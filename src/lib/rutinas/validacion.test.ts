import { describe, expect, it } from "vitest";
import { detectarDeficienciasRutina, detectarHallazgosRutina } from "./validacion";

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

  it("no cuenta como tríceps las extensiones de pierna, los fondos de pecho ni las patadas de glúteo", () => {
    // El caso real que bloqueó al entrenador: el validador reportaba 32 series
    // de tríceps en una rutina que apenas tenía brazos, porque la heurística
    // por nombre ("extension", "fondos", "patada") se aplicaba a TODO el
    // catálogo y no solo a los ejercicios de brazos.
    const dias = [
      {
        nombre: "Piernas",
        ejercicios: [
          { nombre: "Extensión de cuádriceps", series: 8, grupoMuscular: "piernas" },
          { nombre: "Patada de glúteo en polea", series: 8, grupoMuscular: "piernas" },
          { nombre: "Curl femoral", series: 8, grupoMuscular: "piernas" },
        ],
      },
      {
        nombre: "Pecho",
        ejercicios: [
          { nombre: "Press de banca", series: 4, grupoMuscular: "pecho" },
          { nombre: "Fondos en paralelas", series: 8, grupoMuscular: "pecho" },
        ],
      },
    ];
    const errores = detectarDeficienciasRutina(dias).join(" ");
    expect(errores).not.toContain("tríceps");
    expect(errores).not.toContain("bíceps");
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

  it("ubica el error en la sesión y los ejercicios que deben corregirse", () => {
    const hallazgos = detectarHallazgosRutina([{ nombre: "Espalda", ejercicios: [
      { nombre: "Jalón cerrado", series: 4, grupoMuscular: "espalda" },
      { nombre: "Jalón neutro", series: 4, grupoMuscular: "espalda" },
      { nombre: "Hiperextensiones", series: 3, grupoMuscular: "espalda" },
    ] }]);
    expect(hallazgos[0]).toMatchObject({
      diaIndice: 0,
      grupoSugerido: "espalda",
      patronSugerido: "espalda_remo_horizontal",
    });
    expect(hallazgos[0].ejercicioIndices).toEqual([0, 1, 2]);
  });

  it("prefiere el patrón guardado en la galería sobre el nombre", () => {
    const errores = detectarDeficienciasRutina([{ nombre: "Pecho", ejercicios: [
      { nombre: "Máquina VIP A", series: 4, grupoMuscular: "pecho", patronMovimiento: "pecho_press_horizontal" },
      { nombre: "Máquina VIP B", series: 4, grupoMuscular: "pecho", patronMovimiento: "pecho_press_inclinado" },
      { nombre: "Máquina VIP C", series: 3, grupoMuscular: "pecho", patronMovimiento: "pecho_aislamiento" },
    ] }]);
    expect(errores).toEqual([]);
  });
});
