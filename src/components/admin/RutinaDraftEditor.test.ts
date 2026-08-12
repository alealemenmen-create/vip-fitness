import { describe, expect, it } from "vitest";
import { objetivosMuscularesDia, opcionesBibliotecaParaObjetivo, repartirSeriesDelGrupo } from "./RutinaDraftEditor";

describe("orden muscular de la Varita VIP", () => {
  it("respeta exactamente el orden escrito en la sesión", () => {
    expect(objetivosMuscularesDia({ nombre: "Espalda + Tríceps", descripcion: null, ejercicios: [] })).toEqual([
      "espalda",
      "triceps",
    ]);
    expect(objetivosMuscularesDia({ nombre: "Bíceps + Pecho", descripcion: null, ejercicios: [] })).toEqual([
      "biceps",
      "pecho",
    ]);
  });

  it("mantiene core al final cuando forma parte del nombre", () => {
    expect(objetivosMuscularesDia({ nombre: "Piernas + Core", descripcion: null, ejercicios: [] })).toEqual([
      "cuadriceps",
      "femoral",
      "gluteo",
      "core",
    ]);
  });

  it("encuentra opciones de todos los músculos aunque el nombre no repita el grupo", () => {
    const biblioteca = [
      { id: "1", nombre: "Jalón al pecho", grupo: "Espalda", equipo: "Polea" },
      { id: "2", nombre: "Extensión en polea", grupo: "Tríceps", equipo: "Polea" },
      { id: "3", nombre: "Extensión sobre la cabeza", grupo: "Tríceps", equipo: "Mancuerna" },
      { id: "4", nombre: "Fondos", grupo: "Tríceps", equipo: "Peso corporal" },
    ];
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "espalda").map((item) => item.ejercicio.id)).toEqual(["1"]);
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "triceps").map((item) => item.ejercicio.id)).toEqual(["2", "3", "4"]);
  });
});

describe("dosis total por grupo muscular", () => {
  it("reparte el total entre ejercicios sin multiplicarlo", () => {
    expect(repartirSeriesDelGrupo(6, 3)).toEqual([2, 2, 2]);
    expect(repartirSeriesDelGrupo(5, 4)).toEqual([2, 1, 1, 1]);
    expect(repartirSeriesDelGrupo(8, 3)).toEqual([3, 3, 2]);
  });

  it("separa los tres grupos principales inferiores y sus subgrupos", () => {
    expect(objetivosMuscularesDia({ nombre: "Cuádriceps + Glúteo + Femoral", descripcion: "Enfoques: Abductor · Aductor · Pantorrilla", ejercicios: [] })).toEqual([
      "cuadriceps", "gluteo", "femoral", "abductor", "aductor", "pantorrilla",
    ]);
  });

  it("filtra la biblioteca inferior por patrón real", () => {
    const biblioteca = [
      { id: "q", nombre: "Extensión de cuádriceps", grupo: "Piernas", equipo: "Máquina" },
      { id: "f", nombre: "Curl femoral", grupo: "Piernas", equipo: "Máquina" },
      { id: "g", nombre: "Hip thrust", grupo: "Piernas", equipo: "Barra" },
      { id: "a", nombre: "Abductor en máquina", grupo: "Piernas", equipo: "Máquina" },
    ];
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "cuadriceps").map((item) => item.ejercicio.id)).toEqual(["q"]);
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "femoral").map((item) => item.ejercicio.id)).toEqual(["f"]);
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "gluteo").map((item) => item.ejercicio.id)).toEqual(["g"]);
    expect(opcionesBibliotecaParaObjetivo(biblioteca, "abductor").map((item) => item.ejercicio.id)).toEqual(["a"]);
  });
});
