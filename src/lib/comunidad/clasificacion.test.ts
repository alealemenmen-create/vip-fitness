import { describe, expect, it } from "vitest";
import { resumirClasificacionComunidad } from "./clasificacion";

const filas = Array.from({ length: 20 }, (_, indice) => ({
  alumnoId: `alumno-${indice + 1}`,
  puesto: indice + 1,
  esActual: indice === 14,
}));

describe("resumirClasificacionComunidad", () => {
  it("mantiene el top y el contexto del alumno cuando está más abajo", () => {
    const resultado = resumirClasificacionComunidad(filas, false);

    expect(resultado.map((fila) => fila.puesto)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16]);
  });

  it("devuelve toda la clasificación al expandir", () => {
    expect(resumirClasificacionComunidad(filas, true)).toEqual(filas);
  });

  it("no duplica al alumno cuando ya forma parte del top", () => {
    const topConAlumno = filas.map((fila, indice) => ({ ...fila, esActual: indice === 4 }));
    expect(resumirClasificacionComunidad(topConAlumno, false)).toHaveLength(10);
  });
});
