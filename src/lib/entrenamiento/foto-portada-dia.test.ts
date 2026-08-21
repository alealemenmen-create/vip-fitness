import { describe, expect, it } from "vitest";
import {
  candidatosFotoPortada,
  fotoPortadaDia,
  grupoPortadaDia,
  PORTADAS_EDITORIALES_POR_GRUPO,
  type EjercicioParaPortada,
} from "./foto-portada-dia";

function ejercicio(
  ilustracionSlug: string | null,
  grupoMuscular: EjercicioParaPortada["grupoMuscular"],
  nombre?: string
): EjercicioParaPortada {
  return { ilustracionSlug, grupoMuscular, nombre };
}

describe("candidatosFotoPortada", () => {
  it("saca la bicicleta de calentamiento cuando el resto es musculación", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("remo-barra", "espalda"), ejercicio("press-banca", "pecho")];
    expect(candidatosFotoPortada(dia)).toEqual([ejercicio("remo-barra", "espalda"), ejercicio("press-banca", "pecho")]);
  });

  it("deja todo si el día es realmente de cardio (3+)", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("burpees", "cardio"), ejercicio("caminadora", "cardio")];
    expect(candidatosFotoPortada(dia)).toHaveLength(3);
  });
});

describe("biblioteca editorial por grupo", () => {
  it("contiene exactamente dos portadas distintas para cada familia", () => {
    expect(Object.keys(PORTADAS_EDITORIALES_POR_GRUPO)).toEqual([
      "pecho", "espalda", "hombros", "brazos", "piernas", "gluteos", "core", "cardio",
    ]);
    for (const portadas of Object.values(PORTADAS_EDITORIALES_POR_GRUPO)) {
      expect(portadas).toHaveLength(2);
      expect(new Set(portadas).size).toBe(2);
    }
  });

  it("elige por el grupo principal del día y alterna variantes", () => {
    const dia = [ejercicio("press-banca", "pecho")];
    expect(fotoPortadaDia(dia, { variante: 0 })).toBe(PORTADAS_EDITORIALES_POR_GRUPO.pecho[0]);
    expect(fotoPortadaDia(dia, { variante: 1 })).toBe(PORTADAS_EDITORIALES_POR_GRUPO.pecho[1]);
  });

  it("respeta el orden de grupos del resumen aunque otro ejercicio aparezca primero", () => {
    const dia = [ejercicio("curl-barra", "brazos"), ejercicio("jalon-pecho", "espalda")];
    expect(grupoPortadaDia(dia, { gruposMusculares: ["espalda", "brazos"] })).toBe("espalda");
  });

  it("no convierte un calentamiento de bicicleta en una portada de cardio", () => {
    const dia = [ejercicio("bicicleta", "cardio"), ejercicio("remo-barra", "espalda")];
    expect(grupoPortadaDia(dia, { gruposMusculares: ["cardio", "espalda"] })).toBe("espalda");
    expect(fotoPortadaDia(dia, { gruposMusculares: ["cardio", "espalda"], variante: 0 }))
      .toBe(PORTADAS_EDITORIALES_POR_GRUPO.espalda[0]);
  });

  it("reconoce glúteos por el nombre editorial del día", () => {
    const dia = [ejercicio("hip-thrust", "piernas", "Hip thrust"), ejercicio("curl-femoral", "piernas", "Curl femoral")];
    expect(grupoPortadaDia(dia, { nombreDia: "Glúteos + Femoral", gruposMusculares: ["piernas"] })).toBe("gluteos");
  });

  it("reconoce un día dominante de glúteos por sus ejercicios", () => {
    const dia = [
      ejercicio("hip-thrust", "piernas", "Hip thrust"),
      ejercicio("patada-gluteo-polea", "piernas", "Patada de glúteo"),
      ejercicio("curl-femoral", "piernas", "Curl femoral"),
    ];
    expect(grupoPortadaDia(dia, { gruposMusculares: ["piernas"] })).toBe("gluteos");
  });

  it("devuelve null sin grupo ni imagen identificable", () => {
    expect(fotoPortadaDia([ejercicio(null, null)])).toBeNull();
  });
});
