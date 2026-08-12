import { describe, expect, it } from "vitest";
import {
  MINIMO_APUESTA,
  TOPE_APUESTA,
  estimarRetorno,
  repartirApuestas,
  validarApuesta,
  type Apuesta,
} from "./apuestas";

const base = {
  alumnoId: "espectador",
  participantes: ["corredor-a", "corredor-b"],
  saldoDisponible: 1000,
  puntos: 50,
  yaAposto: false,
  apuestasAbiertas: true,
};

describe("validarApuesta", () => {
  it("deja apostar a quien no compite", () => {
    expect(validarApuesta(base)).toEqual({ ok: true });
  });

  it("NO deja apostar a un competidor — podria perder a proposito", () => {
    const r = validarApuesta({ ...base, alumnoId: "corredor-a" });
    expect(r.ok).toBe(false);
  });

  it("no deja apostar dos veces en el mismo torneo", () => {
    expect(validarApuesta({ ...base, yaAposto: true }).ok).toBe(false);
  });

  it("no deja apostar con las apuestas cerradas", () => {
    expect(validarApuesta({ ...base, apuestasAbiertas: false }).ok).toBe(false);
  });

  it("respeta el tope y el minimo", () => {
    expect(validarApuesta({ ...base, puntos: TOPE_APUESTA + 1 }).ok).toBe(false);
    expect(validarApuesta({ ...base, puntos: MINIMO_APUESTA - 1 }).ok).toBe(false);
    expect(validarApuesta({ ...base, puntos: TOPE_APUESTA }).ok).toBe(true);
  });

  it("no deja apostar mas de lo que tiene", () => {
    expect(validarApuesta({ ...base, puntos: 50, saldoDisponible: 40 }).ok).toBe(false);
  });

  it("rechaza puntos fraccionarios", () => {
    expect(validarApuesta({ ...base, puntos: 50.5 }).ok).toBe(false);
  });
});

describe("repartirApuestas", () => {
  it("reparte la bolsa de los que fallaron entre los que acertaron", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "ana", porAlumnoId: "corredor-a", puntos: 100 },
      { alumnoId: "beto", porAlumnoId: "corredor-b", puntos: 100 },
    ];
    const r = repartirApuestas(apuestas, "corredor-a");

    const ana = r.pagos.find((p) => p.alumnoId === "ana")!;
    const beto = r.pagos.find((p) => p.alumnoId === "beto")!;
    // Ana recupera lo suyo (100) y se lleva los 100 de Beto.
    expect(ana.devuelto).toBe(200);
    expect(ana.neto).toBe(100);
    expect(beto.devuelto).toBe(0);
    expect(beto.neto).toBe(-100);
    expect(r.motivoDevolucion).toBeNull();
  });

  it("reparte en proporcion a lo arriesgado, no en partes iguales", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "ana", porAlumnoId: "corredor-a", puntos: 150 },
      { alumnoId: "beto", porAlumnoId: "corredor-a", puntos: 50 },
      { alumnoId: "caro", porAlumnoId: "corredor-b", puntos: 200 },
    ];
    const r = repartirApuestas(apuestas, "corredor-a");

    // Ana arriesgo 3 veces mas que Beto: se lleva 3 veces mas de los 200.
    expect(r.pagos.find((p) => p.alumnoId === "ana")!.neto).toBe(150);
    expect(r.pagos.find((p) => p.alumnoId === "beto")!.neto).toBe(50);
    expect(r.pagos.find((p) => p.alumnoId === "caro")!.neto).toBe(-200);
  });

  it("nunca paga mas de lo que entro a la bolsa", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "a", porAlumnoId: "x", puntos: 33 },
      { alumnoId: "b", porAlumnoId: "x", puntos: 67 },
      { alumnoId: "c", porAlumnoId: "y", puntos: 111 },
      { alumnoId: "d", porAlumnoId: "y", puntos: 7 },
    ];
    const r = repartirApuestas(apuestas, "x");
    const pagado = r.pagos.reduce((t, p) => t + p.devuelto, 0);
    expect(pagado).toBe(r.bolsaTotal);
  });

  it("el sobrante del redondeo no se pierde", () => {
    // 100 a repartir entre tres que arriesgaron lo mismo: 33 + 33 + 33 = 99.
    const apuestas: Apuesta[] = [
      { alumnoId: "a", porAlumnoId: "x", puntos: 10 },
      { alumnoId: "b", porAlumnoId: "x", puntos: 10 },
      { alumnoId: "c", porAlumnoId: "x", puntos: 10 },
      { alumnoId: "d", porAlumnoId: "y", puntos: 100 },
    ];
    const r = repartirApuestas(apuestas, "x");
    const pagado = r.pagos.reduce((t, p) => t + p.devuelto, 0);
    expect(pagado).toBe(r.bolsaTotal);
  });

  it("devuelve todo si nadie le acerto al ganador", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "ana", porAlumnoId: "corredor-a", puntos: 100 },
      { alumnoId: "beto", porAlumnoId: "corredor-a", puntos: 50 },
    ];
    const r = repartirApuestas(apuestas, "corredor-b");
    expect(r.motivoDevolucion).toBe("nadie_acerto");
    expect(r.pagos.every((p) => p.neto === 0 && p.devuelto === p.apostado)).toBe(true);
  });

  it("devuelve todo si acertaron todos — no hay de donde pagar", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "ana", porAlumnoId: "corredor-a", puntos: 100 },
      { alumnoId: "beto", porAlumnoId: "corredor-a", puntos: 50 },
    ];
    const r = repartirApuestas(apuestas, "corredor-a");
    expect(r.motivoDevolucion).toBe("todos_acertaron");
    expect(r.pagos.every((p) => p.neto === 0)).toBe(true);
  });

  it("devuelve todo si hubo empate o se anulo el torneo", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "ana", porAlumnoId: "corredor-a", puntos: 100 },
      { alumnoId: "beto", porAlumnoId: "corredor-b", puntos: 40 },
    ];
    const r = repartirApuestas(apuestas, null);
    expect(r.motivoDevolucion).toBe("sin_ganador");
    expect(r.pagos.every((p) => p.neto === 0 && p.devuelto === p.apostado)).toBe(true);
  });

  it("sin apuestas no rompe nada", () => {
    expect(repartirApuestas([], "corredor-a")).toEqual({
      pagos: [],
      bolsaTotal: 0,
      motivoDevolucion: null,
    });
  });
});

describe("estimarRetorno", () => {
  it("con nadie en contra, el retorno es lo apostado", () => {
    const r = estimarRetorno([{ alumnoId: "a", porAlumnoId: "x", puntos: 50 }], "x", 50);
    expect(r.multiplicador).toBe(1);
    expect(r.retornoEstimado).toBe(50);
  });

  it("apostar al menos favorito paga mas", () => {
    const apuestas: Apuesta[] = [
      { alumnoId: "a", porAlumnoId: "favorito", puntos: 400 },
      { alumnoId: "b", porAlumnoId: "tapado", puntos: 50 },
    ];
    const alTapado = estimarRetorno(apuestas, "tapado", 50);
    const alFavorito = estimarRetorno(apuestas, "favorito", 50);
    expect(alTapado.multiplicador).toBeGreaterThan(alFavorito.multiplicador);
  });
});
