import { describe, expect, it } from "vitest";
import { idsAlimentosRecientes, type RegistroHistorialAlimentos } from "./historialReciente";

function registro(
  fecha: string,
  comidas: Array<{ hora: string | null; ids: Array<string | null> }>,
): RegistroHistorialAlimentos {
  return {
    fecha,
    comidas_registradas: comidas.map((comida) => ({
      registrado_en: comida.hora,
      alimentos_consumidos: comida.ids.map((alimento_id) => ({ alimento_id })),
    })),
  };
}

describe("idsAlimentosRecientes", () => {
  it("ordena por día y comida, elimina duplicados y respeta el límite", () => {
    const resultado = idsAlimentosRecientes([
      registro("2026-08-18", [{ hora: "2026-08-18T08:00:00Z", ids: ["pan", "leche"] }]),
      registro("2026-08-19", [
        { hora: "2026-08-19T09:00:00Z", ids: ["leche", "avena"] },
        { hora: "2026-08-19T13:00:00Z", ids: ["pollo", null] },
      ]),
    ], 4);

    expect(resultado).toEqual(["pollo", "leche", "avena", "pan"]);
  });

  it("tolera días históricos sin hora y límites inválidos", () => {
    const datos = [registro("2026-08-19", [{ hora: null, ids: ["arroz", "arroz"] }])];
    expect(idsAlimentosRecientes(datos)).toEqual(["arroz"]);
    expect(idsAlimentosRecientes(datos, 0)).toEqual([]);
  });
});
