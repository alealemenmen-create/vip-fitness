import { describe, expect, it } from "vitest";
import { ordenarYPosicionar, rivalInmediatamenteSuperior } from "./ordenar";

describe("ranking con empates", () => {
  it("da la misma posición a quienes tienen el mismo puntaje del periodo", () => {
    const filas = ordenarYPosicionar([
      { nombre: "A", puntos: 105, puntosAcumulados: 100, posicion: 0 },
      { nombre: "B", puntos: 30, puntosAcumulados: 900, posicion: 0 },
      { nombre: "C", puntos: 30, puntosAcumulados: 10, posicion: 0 },
      { nombre: "D", puntos: 5, puntosAcumulados: 5000, posicion: 0 },
    ]);

    expect(filas.map((fila) => [fila.nombre, fila.posicion])).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 2],
      ["D", 4],
    ]);
  });

  it("busca el puntaje superior real y no a otro alumno empatado", () => {
    const filas = [{ puntos: 105 }, { puntos: 30 }, { puntos: 30 }];
    expect(rivalInmediatamenteSuperior(filas, 30)).toEqual({ puntos: 105 });
  });
});
