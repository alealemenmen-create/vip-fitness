import { describe, expect, it } from "vitest";
import {
  auditarCompatibilidadDivisionVipV2,
  opcionesDivisionSemanalVipV2,
  seleccionarOpcionDivisionVipV2,
} from "@/lib/generador-rutinas-v2/divisiones";
import { crearEntrevistaVipV2, type DivisionCompetitivaV2 } from "@/lib/generador-rutinas-v2/tipos";

const CATEGORIAS: DivisionCompetitivaV2[] = [
  "mens_open", "mens_212", "classic_physique", "mens_physique", "mens_wheelchair",
  "womens_bodybuilding", "womens_physique", "figure", "bikini", "wellness", "fitness", "fit_model",
];

function entrevistaCategoria(categoria: DivisionCompetitivaV2) {
  const entrevista = crearEntrevistaVipV2(`division-${categoria}`);
  entrevista.competencia.compite = "si";
  entrevista.competencia.division = categoria;
  entrevista.recursos.modoDistribucionDias = "manual";
  entrevista.recursos.diasReales = 5;
  return entrevista;
}

describe("Catálogo de divisiones semanales VIP 2.1", () => {
  it.each(CATEGORIAS)("ofrece varias divisiones específicas para %s", (categoria) => {
    const opciones = opcionesDivisionSemanalVipV2(entrevistaCategoria(categoria), 5);
    const especificas = opciones.filter((opcion) => opcion.categoria === categoria);

    expect(especificas.length).toBeGreaterThanOrEqual(3);
    expect(especificas.every((opcion) => opcion.dias.length === 5)).toBe(true);
  });

  it("respeta la opción manual dentro de una misma categoría", () => {
    const entrevista = entrevistaCategoria("classic_physique");
    entrevista.recursos.modoDivisionSemanal = "manual";
    entrevista.recursos.divisionSemanalId = "classic_torso_frecuente_5";

    const elegida = seleccionarOpcionDivisionVipV2(entrevista, 5);

    expect(elegida.id).toBe("classic_torso_frecuente_5");
    expect(elegida.dias.map((dia) => dia.nombre)).toEqual([
      "Espalda + hombro lateral",
      "Piernas A · cuádriceps",
      "Pecho + brazos",
      "Espalda + hombros",
      "Piernas B · cadena posterior",
    ]);
  });

  it("la recomendación cambia con la categoría competitiva", () => {
    const classic = seleccionarOpcionDivisionVipV2(entrevistaCategoria("classic_physique"), 5);
    const wellness = seleccionarOpcionDivisionVipV2(entrevistaCategoria("wellness"), 5);

    expect(classic.id).toBe("classic_v_taper_5");
    expect(wellness.id).toBe("wellness_clasica_5");
    expect(classic.dias.map((dia) => dia.nombre)).not.toEqual(wellness.dias.map((dia) => dia.nombre));
  });

  it("prohíbe programar un grupo fuera del día declarado", () => {
    const division = seleccionarOpcionDivisionVipV2(entrevistaCategoria("wellness"), 5);
    const bloquesInvalidos = division.dias.map(() => [] as Array<{ grupo: "pecho" | "cuadriceps" }>);
    bloquesInvalidos[0].push({ grupo: "pecho" });

    expect(auditarCompatibilidadDivisionVipV2(bloquesInvalidos, division)).toEqual([
      "pecho no está autorizado en Glúteos + cuádriceps.",
    ]);
  });

  it("un día regional no autoriza regiones inferiores que no declara", () => {
    const general = crearEntrevistaVipV2("general-5");
    const division = seleccionarOpcionDivisionVipV2(general, 5);

    expect(division.dias[2].nombre).toBe("Cuádriceps + aductores");
    expect(division.dias[2].grupos).toContain("cuadriceps");
    expect(division.dias[2].grupos).not.toContain("femorales");
    expect(division.dias[4].grupos).toEqual(expect.arrayContaining(["femorales", "gluteos"]));
    expect(division.dias[4].grupos).not.toContain("cuadriceps");
  });
});
