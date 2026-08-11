import { describe, expect, it } from "vitest";
import { objetivosMuscularesDia, opcionesBibliotecaParaObjetivo } from "./RutinaDraftEditor";

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
      "piernas",
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
