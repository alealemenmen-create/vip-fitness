import { describe, expect, it } from "vitest";
import { leerSeriesFormulario } from "./leer-series-formulario";

describe("leerSeriesFormulario", () => {
  it("mantiene separados los pesos A y B de una biserie", () => {
    const datos = new FormData();
    datos.set("peso_1", "20,5");
    datos.set("reps_1", "12");
    datos.set("realizada_1", "true");
    datos.set("peso_corporal_1", "false");
    datos.set("peso_1_1", "35");
    datos.set("reps_1_1", "10");
    datos.set("realizada_1_1", "true");
    datos.set("peso_corporal_1_1", "false");

    const ejercicioA = leerSeriesFormulario(datos, "ejercicio-a", 1, "");
    const ejercicioB = leerSeriesFormulario(datos, "ejercicio-b", 1, "_1");

    expect(ejercicioA).toMatchObject({ ok: true, filas: [{ sesion_ejercicio_id: "ejercicio-a", peso_kg: 20.5 }] });
    expect(ejercicioB).toMatchObject({ ok: true, filas: [{ sesion_ejercicio_id: "ejercicio-b", peso_kg: 35 }] });
  });

  it("rechaza texto y valores fuera de rango en vez de enviarlos a la base", () => {
    const datos = new FormData();
    datos.set("peso_1", "mucho");
    expect(leerSeriesFormulario(datos, "ejercicio-a", 1, "")).toEqual({
      ok: false,
      error: "Ingresa un peso válido entre 0 y 1000 kg.",
    });
  });

  it("guarda el RIR de cada serie y rechaza valores fuera de 0 a 5", () => {
    const valido = new FormData();
    valido.set("peso_1", "24");
    valido.set("reps_1", "10");
    valido.set("rir_1", "2");
    expect(leerSeriesFormulario(valido, "ejercicio-a", 1, "")).toMatchObject({
      ok: true,
      filas: [{ rir_estimado: 2 }],
    });

    const invalido = new FormData();
    invalido.set("rir_1", "6");
    expect(leerSeriesFormulario(invalido, "ejercicio-a", 1, "")).toEqual({
      ok: false,
      error: "El RIR debe estar entre 0 y 5.",
    });
  });
});
