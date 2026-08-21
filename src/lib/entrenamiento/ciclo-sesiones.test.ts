import { describe, it, expect } from "vitest";
import {
  descansosDespuesDe,
  diaDelNumero,
  diasQueNumeran,
  mesDelNumero,
  semanaDelMes,
  semanaDelNumero,
  sesionDeLaSemana,
  sesionDelMes,
  sesionesPorMes,
} from "./ciclo-sesiones";

/** La rutina real que reportó el desfase: 4 entrenamientos y un descanso en
 * el medio, que la app contaba como 5 días. */
const RUTINA_CON_DESCANSO = [
  { id: "pecho", tipo: "entrenamiento" as const },
  { id: "pierna", tipo: "entrenamiento" as const },
  { id: "espalda", tipo: "entrenamiento" as const },
  { id: "desc", tipo: "descanso" as const },
  { id: "hombros", tipo: "entrenamiento" as const },
];

describe("diasQueNumeran", () => {
  it("deja fuera los descansos", () => {
    expect(diasQueNumeran(RUTINA_CON_DESCANSO).map((d) => d.id)).toEqual([
      "pecho",
      "pierna",
      "espalda",
      "hombros",
    ]);
  });

  it("una rutina sin descansos queda igual", () => {
    const sinDescanso = [
      { id: "a", tipo: "entrenamiento" as const },
      { id: "b", tipo: "entrenamiento" as const },
    ];
    expect(diasQueNumeran(sinDescanso)).toHaveLength(2);
  });
});

describe("descansosDespuesDe", () => {
  it("marca el día de entrenamiento que lleva un descanso detrás", () => {
    expect(descansosDespuesDe(RUTINA_CON_DESCANSO)).toEqual(["espalda"]);
  });

  it("varios descansos seguidos cuentan como uno", () => {
    expect(
      descansosDespuesDe([
        { id: "a", tipo: "entrenamiento" },
        { id: "d1", tipo: "descanso" },
        { id: "d2", tipo: "descanso" },
        { id: "b", tipo: "entrenamiento" },
      ])
    ).toEqual(["a"]);
  });

  it("un descanso al final no cuelga de ningún día visible", () => {
    expect(descansosDespuesDe([{ id: "a", tipo: "entrenamiento" }, { id: "d", tipo: "descanso" }])).toEqual(["a"]);
  });
});

describe("la rueda no se desfasa", () => {
  const ciclo = diasQueNumeran(RUTINA_CON_DESCANSO);

  it("todas las semanas arrancan con el mismo día", () => {
    // Este es EL caso del bug: antes la rueda giraba de a 5 y la pantalla
    // paginaba de a 4, así que la semana 2 empezaba con "hombros".
    const sesionesPorSemana = ciclo.length;
    const primeroDeCadaSemana = [1, 2, 3, 4].map(
      (semana) => diaDelNumero(ciclo, (semana - 1) * sesionesPorSemana + 1)?.id
    );
    expect(primeroDeCadaSemana).toEqual(["pecho", "pecho", "pecho", "pecho"]);
  });

  it("la semana entera se repite igual", () => {
    const semana1 = [1, 2, 3, 4].map((n) => diaDelNumero(ciclo, n)?.id);
    const semana2 = [5, 6, 7, 8].map((n) => diaDelNumero(ciclo, n)?.id);
    expect(semana1).toEqual(["pecho", "pierna", "espalda", "hombros"]);
    expect(semana2).toEqual(semana1);
  });

  it("el descanso ya no ocupa ningún número", () => {
    const ochoPrimeros = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => diaDelNumero(ciclo, n)?.id);
    expect(ochoPrimeros).not.toContain("desc");
  });

  it("sin días no inventa ninguno, y los números arrancan en 1", () => {
    expect(diaDelNumero([], 1)).toBeNull();
    expect(diaDelNumero(ciclo, 0)).toBeNull();
  });
});

describe("numeración que ve el alumno", () => {
  it("una rutina de 3 muestra sesión 1, 2, 3 y vuelve a 1", () => {
    expect([1, 2, 3, 4].map((n) => sesionDeLaSemana(n, 3))).toEqual([1, 2, 3, 1]);
  });

  it("una de 5 llega hasta 5 sin saltarse ninguna", () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => sesionDeLaSemana(n, 5))).toEqual([1, 2, 3, 4, 5, 1]);
  });

  it("la semana empieza en 1", () => {
    expect(semanaDelNumero(1, 4)).toBe(1);
    expect(semanaDelNumero(4, 4)).toBe(1);
    expect(semanaDelNumero(5, 4)).toBe(2);
  });
});

describe("el mes que ve el alumno", () => {
  it("una rutina de 3 dias son 12 sesiones al mes", () => {
    expect(sesionesPorMes(3)).toBe(12);
    expect(sesionesPorMes(5)).toBe(20);
  });

  it("el caso exacto que pidio Alejandro: 12 sesiones repartidas de a 3", () => {
    // Semana 1 hace las primeras tres, semana 2 las siguientes tres, y así
    // hasta completar las doce.
    const porSemana = [1, 2, 3, 4].map((semana) =>
      [1, 2, 3].map((i) => sesionDelMes((semana - 1) * 3 + i, 3))
    );
    expect(porSemana).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
    ]);
  });

  it("terminadas las doce, el mes vuelve a empezar", () => {
    expect(sesionDelMes(12, 3)).toBe(12);
    expect(sesionDelMes(13, 3)).toBe(1);
    expect(semanaDelMes(4)).toBe(4);
    expect(semanaDelMes(5)).toBe(1);
    expect(semanaDelMes(9)).toBe(1);
  });

  it("la semana del mes nunca pasa de 4 ni baja de 1", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(semanaDelMes)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(semanaDelMes(0)).toBe(1);
  });
});

describe("mesDelNumero", () => {
  it("las primeras 12 sesiones de una rutina de 3 días caen en el mes 1", () => {
    expect([1, 6, 12].map((n) => mesDelNumero(n, 3))).toEqual([1, 1, 1]);
  });

  it("la sesión 13 ya es del mes 2", () => {
    expect(mesDelNumero(13, 3)).toBe(2);
    expect(mesDelNumero(24, 3)).toBe(2);
    expect(mesDelNumero(25, 3)).toBe(3);
  });

  it("una rutina de 5 días son bloques de 20", () => {
    expect(mesDelNumero(20, 5)).toBe(1);
    expect(mesDelNumero(21, 5)).toBe(2);
  });
});
