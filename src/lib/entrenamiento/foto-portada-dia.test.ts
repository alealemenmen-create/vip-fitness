import { describe, expect, it } from "vitest";
import { candidatosFotoPortada, fotoPortadaDia, type EjercicioParaPortada } from "./foto-portada-dia";

function ejercicio(ilustracionSlug: string | null, grupoMuscular: EjercicioParaPortada["grupoMuscular"]): EjercicioParaPortada {
  return { ilustracionSlug, grupoMuscular };
}

describe("candidatosFotoPortada", () => {
  it("saca la bicicleta de calentamiento cuando el resto es musculación", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("remo-barra", "espalda"), ejercicio("press-banca", "pecho")];
    expect(candidatosFotoPortada(dia)).toEqual([ejercicio("remo-barra", "espalda"), ejercicio("press-banca", "pecho")]);
  });

  it("deja todo si el día es realmente de cardio (3+)", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("bicicleta", "cardio"), ejercicio("bicicleta", "cardio")];
    expect(candidatosFotoPortada(dia)).toHaveLength(3);
  });
});

describe("fotoPortadaDia", () => {
  it("prefiere la foto curada del grupo por sobre el primer ejercicio del día", () => {
    const dia = [ejercicio("extension-cuadriceps", "piernas"), ejercicio("sentadilla", "piernas")];
    expect(fotoPortadaDia(dia)).toBe("/ejercicios-completas/sentadilla.webp");
  });

  it("ignora la bicicleta de calentamiento al elegir portada de un día de espalda", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("remo-barra", "espalda")];
    expect(fotoPortadaDia(dia)).toBe("/ejercicios-completas/remo-barra.webp");
  });

  it("cae al primero disponible si ninguno está en la lista curada", () => {
    const dia = [ejercicio("face-pull", "espalda")];
    expect(fotoPortadaDia(dia)).toBe("/ejercicios-completas/face-pull.webp");
  });

  it("devuelve null sin ejercicios con foto identificada", () => {
    expect(fotoPortadaDia([ejercicio(null, "pecho")])).toBeNull();
  });
});
