import { describe, expect, it } from "vitest";
import {
  configuracionFst7,
  esUltimaPosicionSerie,
  normalizarTecnicaSesion,
  planificarBloqueEncadenado,
  planificarSegmentosTecnica,
} from "./motor-tecnicas-sesion";

describe("normalizarTecnicaSesion", () => {
  it.each([
    ["Biserie (1/2)", "biserie"],
    ["SERIE GIGANTE (3/4)", "giant-set"],
    ["FST-7", "fst-7"],
    ["Rest pause", "rest-pause"],
    ["Fallo muscular", "fallo-tecnico"],
  ])("reconoce %s", (texto, esperado) => {
    expect(normalizarTecnicaSesion(texto)).toBe(esperado);
  });
});

describe("planificarBloqueEncadenado", () => {
  it("ejecuta una triserie por rondas y descansa solo al final", () => {
    const pasos = planificarBloqueEncadenado({
      tecnica: "triserie",
      ejercicios: [
        { ejercicioId: "a", series: 2 },
        { ejercicioId: "b", series: 2 },
        { ejercicioId: "c", series: 2 },
      ],
      descansoFinalSegundos: 90,
    });

    expect(pasos.map((paso) => paso.tipo === "serie" ? `${paso.ejercicioId}${paso.serieNumero}` : "descanso"))
      .toEqual(["a1", "b1", "c1", "descanso", "a2", "b2", "c2"]);
  });

  it("una serie gigante admite cuatro estaciones", () => {
    const pasos = planificarBloqueEncadenado({
      tecnica: "giant-set",
      ejercicios: ["a", "b", "c", "d"].map((ejercicioId) => ({ ejercicioId, series: 1 })),
      descansoFinalSegundos: 120,
    });
    expect(pasos.filter((paso) => paso.tipo === "serie")).toHaveLength(4);
    expect(pasos.some((paso) => paso.tipo === "descanso_bloque")).toBe(false);
  });

  it("detecta el cierre real cuando las estaciones tienen distintas series", () => {
    const pasos = planificarBloqueEncadenado({
      tecnica: "superserie",
      ejercicios: [
        { ejercicioId: "a", series: 4 },
        { ejercicioId: "b", series: 3 },
      ],
      descansoFinalSegundos: 90,
    }).filter((paso) => paso.tipo === "serie");
    const orden = pasos.map((paso) => ({
      ejercicioIndice: paso.ejercicioId === "a" ? 0 : 1,
      serieIndice: (paso.serieNumero ?? 1) - 1,
    }));

    expect(orden.at(-1)).toEqual({ ejercicioIndice: 0, serieIndice: 3 });
    expect(esUltimaPosicionSerie(orden, 0, 3)).toBe(true);
    expect(esUltimaPosicionSerie(orden, 1, 2)).toBe(false);
  });
});

describe("planificarSegmentosTecnica", () => {
  it("drop set exige ajuste de carga sin introducir descanso", () => {
    const segmentos = planificarSegmentosTecnica({ tecnica: "drop-set", repsBase: "10" });
    expect(segmentos.map((segmento) => segmento.tipo)).toEqual(["trabajo", "ajuste_carga", "trabajo"]);
    expect(segmentos.some((segmento) => segmento.tipo === "microdescanso")).toBe(false);
  });

  it("rest-pause y myo-reps generan pausas navegables", () => {
    expect(planificarSegmentosTecnica({ tecnica: "rest-pause", repsBase: "8" })[1]).toMatchObject({ tipo: "microdescanso", segundos: 15 });
    expect(planificarSegmentosTecnica({ tecnica: "myo-reps", repsBase: "15", miniSeries: 4 }).filter((segmento) => segmento.tipo === "trabajo")).toHaveLength(5);
  });

  it("cluster conserva cuatro bloques con tres microdescansos", () => {
    const segmentos = planificarSegmentosTecnica({ tecnica: "cluster-set", repsBase: "8", miniSeries: 4 });
    expect(segmentos.filter((segmento) => segmento.tipo === "trabajo")).toHaveLength(4);
    expect(segmentos.filter((segmento) => segmento.tipo === "microdescanso")).toHaveLength(3);
  });

  it("FST-7 son siete series reales con descansos de 30 segundos", () => {
    expect(configuracionFst7()).toEqual({ series: 7, reps: "10–15", descansoEntreSeries: 30, descansoFinal: 90 });
  });
});
