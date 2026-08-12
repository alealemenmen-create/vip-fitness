/**
 * Apuestas de Arena VIP — el modelo de la carrera de caballos.
 *
 * El problema que resuelve, en palabras de Alejandro: "hice un torneo y fue
 * fome". Un duelo entre dos personas le importa a dos personas; los otros 66
 * alumnos ni se enteran. En una carrera de caballos no corre el público — y
 * sin embargo el público es el que grita. Eso es lo que falta acá.
 *
 * Reglas, y el porqué de cada una:
 *
 * - **Apuesta el que NO compite.** Si un competidor pudiera apostar contra sí
 *   mismo, tendría un motivo para perder a propósito. Es la única regla que no
 *   se negocia.
 * - **Reparto tipo pari-mutuel**: los que aciertan recuperan lo suyo y se
 *   reparten lo de los que fallaron, en proporción a lo que arriesgaron. No
 *   hay cuotas fijas que calcular ni casa que gane: lo que entra, sale.
 * - **Si nadie le acertó al ganador, se devuelve todo.** Sin esto los puntos
 *   desaparecerían del gimnasio, y el saldo de los alumnos solo bajaría.
 * - **Empate o torneo anulado: se devuelve todo.** Misma razón.
 * - **Tope por apuesta.** Que nadie se funda de una: el alumno ganó esos
 *   puntos entrenando.
 *
 * Este archivo es solo aritmética: no toca la base ni sabe de usuarios. Así se
 * puede probar entero, que es lo que importa cuando se mueven puntos ajenos.
 */

import type { ResultadoTorneo } from "./puntos";

/** Nadie arriesga más que esto en una sola apuesta. */
export const TOPE_APUESTA = 200;
/** Mínimo, para que la apuesta signifique algo. */
export const MINIMO_APUESTA = 10;

export type Apuesta = {
  alumnoId: string;
  /** Por quién apostó. */
  porAlumnoId: string;
  puntos: number;
};

export type PagoApuesta = {
  alumnoId: string;
  /** Lo que arriesgó. */
  apostado: number;
  /** Lo que recibe de vuelta EN TOTAL (incluye lo suyo si acertó). */
  devuelto: number;
  /** Ganancia neta: positiva si acertó, negativa si perdió. */
  neto: number;
  acerto: boolean;
};

export type ResultadoApuestas = {
  pagos: PagoApuesta[];
  /** Total que se movió: sirve para mostrar "se apostaron X puntos". */
  bolsaTotal: number;
  /** Por qué se devolvió todo, si fue el caso. `null` si hubo reparto real. */
  motivoDevolucion: "sin_ganador" | "nadie_acerto" | "todos_acertaron" | null;
};

/** ¿Puede este alumno apostar en este torneo, y por cuánto? */
export function validarApuesta(params: {
  alumnoId: string;
  participantes: string[];
  saldoDisponible: number;
  puntos: number;
  yaAposto: boolean;
  apuestasAbiertas: boolean;
}): { ok: true } | { ok: false; motivo: string } {
  if (!params.apuestasAbiertas) {
    return { ok: false, motivo: "Las apuestas de este torneo ya cerraron." };
  }
  if (params.participantes.includes(params.alumnoId)) {
    return { ok: false, motivo: "Estás compitiendo en este torneo: no puedes apostar en él." };
  }
  if (params.yaAposto) {
    return { ok: false, motivo: "Ya tienes una apuesta en este torneo." };
  }
  if (!Number.isInteger(params.puntos) || params.puntos < MINIMO_APUESTA) {
    return { ok: false, motivo: `La apuesta mínima es de ${MINIMO_APUESTA} Puntos VIP.` };
  }
  if (params.puntos > TOPE_APUESTA) {
    return { ok: false, motivo: `El máximo por apuesta es de ${TOPE_APUESTA} Puntos VIP.` };
  }
  if (params.puntos > params.saldoDisponible) {
    return { ok: false, motivo: "No te alcanzan los Puntos VIP para esa apuesta." };
  }
  return { ok: true };
}

/**
 * Reparte la bolsa. `ganadorId` es `null` si hubo empate o el torneo se anuló.
 *
 * Los redondeos se hacen hacia abajo y el sobrante va al que más arriesgó:
 * repartir de a centésimas de punto no tiene sentido, y tirar el resto haría
 * que la suma pagada no cuadre con la apostada.
 */
export function repartirApuestas(apuestas: Apuesta[], ganadorId: string | null): ResultadoApuestas {
  const bolsaTotal = apuestas.reduce((total, a) => total + a.puntos, 0);

  const devolverTodo = (motivo: ResultadoApuestas["motivoDevolucion"]): ResultadoApuestas => ({
    pagos: apuestas.map((a) => ({
      alumnoId: a.alumnoId,
      apostado: a.puntos,
      devuelto: a.puntos,
      neto: 0,
      acerto: false,
    })),
    bolsaTotal,
    motivoDevolucion: motivo,
  });

  if (apuestas.length === 0) {
    return { pagos: [], bolsaTotal: 0, motivoDevolucion: null };
  }
  if (ganadorId === null) return devolverTodo("sin_ganador");

  const acertaron = apuestas.filter((a) => a.porAlumnoId === ganadorId);
  const fallaron = apuestas.filter((a) => a.porAlumnoId !== ganadorId);

  if (acertaron.length === 0) return devolverTodo("nadie_acerto");
  if (fallaron.length === 0) return devolverTodo("todos_acertaron");

  const bolsaPerdedores = fallaron.reduce((total, a) => total + a.puntos, 0);
  const totalAcertado = acertaron.reduce((total, a) => total + a.puntos, 0);

  // Reparto proporcional a lo arriesgado, redondeando hacia abajo.
  const ganancias = new Map<string, number>();
  let repartido = 0;
  for (const a of acertaron) {
    const ganancia = Math.floor((bolsaPerdedores * a.puntos) / totalAcertado);
    ganancias.set(a.alumnoId, ganancia);
    repartido += ganancia;
  }
  // El sobrante del redondeo va al que más arriesgó (empate: el primero).
  const sobrante = bolsaPerdedores - repartido;
  if (sobrante > 0) {
    const mayor = acertaron.reduce((mejor, a) => (a.puntos > mejor.puntos ? a : mejor));
    ganancias.set(mayor.alumnoId, (ganancias.get(mayor.alumnoId) ?? 0) + sobrante);
  }

  const pagos: PagoApuesta[] = apuestas.map((a) => {
    const acerto = a.porAlumnoId === ganadorId;
    const ganancia = acerto ? (ganancias.get(a.alumnoId) ?? 0) : 0;
    return {
      alumnoId: a.alumnoId,
      apostado: a.puntos,
      devuelto: acerto ? a.puntos + ganancia : 0,
      neto: acerto ? ganancia : -a.puntos,
      acerto,
    };
  });

  return { pagos, bolsaTotal, motivoDevolucion: null };
}

/**
 * Quién ganó, según el snapshot de resultados del torneo — el dato que
 * `repartirApuestas` necesita como `ganadorId`.
 *
 * Devuelve `null` si hubo empate en el primer puesto o si nadie registró una
 * marca válida. No es un caso de borde raro: `calcularResultadoTorneo` le da
 * puesto 1 a TODOS los empatados, y pagarle a los que apostaron por uno de dos
 * empatados sería inventar un ganador que la competencia no tuvo. Con `null`,
 * el motor devuelve todo lo apostado, que es la única salida honesta.
 */
export function ganadorDeResultados(resultados: ResultadoTorneo[]): string | null {
  const primeros = resultados.filter((r) => r.puesto === 1 && r.valido !== false);
  return primeros.length === 1 ? primeros[0].alumnoId : null;
}

/**
 * Lo que se le muestra al alumno ANTES de apostar: cuánto se llevaría si
 * acierta, con lo apostado hasta ahora. Es una estimación y hay que decirlo —
 * cambia con cada apuesta nueva que entre después.
 */
export function estimarRetorno(
  apuestas: Apuesta[],
  porAlumnoId: string,
  puntosApropios: number
): { multiplicador: number; retornoEstimado: number } {
  const aFavor = apuestas
    .filter((a) => a.porAlumnoId === porAlumnoId)
    .reduce((t, a) => t + a.puntos, 0) + puntosApropios;
  const enContra = apuestas
    .filter((a) => a.porAlumnoId !== porAlumnoId)
    .reduce((t, a) => t + a.puntos, 0);

  if (enContra === 0) return { multiplicador: 1, retornoEstimado: puntosApropios };
  const ganancia = Math.floor((enContra * puntosApropios) / aFavor);
  const retorno = puntosApropios + ganancia;
  return {
    multiplicador: Number((retorno / puntosApropios).toFixed(2)),
    retornoEstimado: retorno,
  };
}
