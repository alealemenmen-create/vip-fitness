/**
 * Reglas de puntaje del ranking VIP (documento de especificación 2026-07-28).
 * Son funciones puras: reciben lo que el alumno hizo en la semana y devuelven
 * el desglose de puntos. No tocan la base — así el mismo cálculo sirve para
 * mostrar el ranking, simular y, más adelante, cerrar la semana.
 */

export const RANGOS = [
  { nombre: "Bronze", desde: 0, imagen: "/rangos/rank_bronze.png", color: "#c88a4a" },
  { nombre: "Silver", desde: 10_000, imagen: "/rangos/rank_silver.png", color: "#c0c4cc" },
  { nombre: "Gold", desde: 25_000, imagen: "/rangos/rank_gold.png", color: "#ffc247" },
  { nombre: "Platinum", desde: 50_000, imagen: "/rangos/rank_platinum.png", color: "#8fd4e8" },
  { nombre: "Diamond", desde: 100_000, imagen: "/rangos/rank_diamond.png", color: "#5fc8ff" },
  { nombre: "Champion", desde: 250_000, imagen: "/rangos/rank_champion.png", color: "#a78bfa" },
  {
    nombre: "Olympian VIP",
    desde: 1_000_000,
    imagen: "/rangos/rank_olympian_vip.png",
    color: "#7ec8ff",
  },
] as const;

export type Rango = (typeof RANGOS)[number];

/** El rango que le corresponde a un puntaje neto acumulado. */
export function rangoDePuntos(puntos: number): Rango {
  let actual: Rango = RANGOS[0];
  for (const rango of RANGOS) {
    if (puntos >= rango.desde) actual = rango;
  }
  return actual;
}

/** Cuánto falta para el siguiente rango; null si ya es Olympian VIP. */
export function progresoAlSiguiente(
  puntos: number
): { siguiente: Rango; faltan: number; pct: number } | null {
  const indice = RANGOS.findIndex((r) => r.nombre === rangoDePuntos(puntos).nombre);
  const siguiente = RANGOS[indice + 1];
  if (!siguiente) return null;

  const base = RANGOS[indice].desde;
  const faltan = siguiente.desde - puntos;
  const pct = Math.round(((puntos - base) / (siguiente.desde - base)) * 100);
  return { siguiente, faltan, pct: Math.max(0, Math.min(100, pct)) };
}

// ── Tabla de puntos ──────────────────────────────────────────────────────
export const PUNTOS = {
  asistencia: {
    /**
     * Subido de 1.000 a 3.000 por sesión — decisión del usuario, 2026-07-28 —
     * para equilibrar contra la alimentación (antes pesaba el 80% del total).
     */
    sesion: 3_000,
    semanaCompleta: 500,
    falta: -800,
    extraDosFaltas: -500,
  },
  alimentacion: {
    /**
     * El día de alimentación vale lo mismo para todos y se reparte entre las
     * comidas del plan de cada alumno: con 6 comidas cada una suma 500, con 3
     * suma 1.000. Así nadie compite en desventaja por tener un plan más
     * exigente — decisión del usuario, 2026-07-28.
     */
    puntosPorDia: 3_000,
    castigoPorDia: -900,
    diaCompleto: 200,
    semanaCompleta: 1_000,
    extraDiaVacio: -400,
    extraMenosDeLaMitad: -2_000,
  },
  app: {
    ingresoDiario: 200,
    pesoSemanal: 300,
    checkinDiario: 100,
    sinCheckin: -80,
    sinPesoSemanal: -200,
  },
} as const;

export type DesgloseSemana = {
  asistencia: number;
  alimentacion: number;
  app: number;
  /** Lo que suma la semana, nunca menor a 0 (decisión del usuario: una mala
   * semana hace perder lo que se podía ganar, pero no muestra un número rojo
   * gigante que desmotive). */
  total: number;
  /** El total real antes del piso, para que el entrenador vea la magnitud. */
  totalCrudo: number;
};

export type DatosSemana = {
  /** Sesiones que le tocaban según su rutina (3, 4 o 5). */
  sesionesProgramadas: number;
  sesionesHechas: number;
  /** Comidas del plan de ESTE alumno (sale de su PDF de alimentación). */
  comidasPorDia: number;
  /** Días de la semana ya transcurridos, para no penalizar el futuro. */
  diasTranscurridos: number;
  /** Comidas efectivamente registradas en la semana. */
  comidasRegistradas: number;
  /** Días en que registró TODAS sus comidas. */
  diasCompletos: number;
  /** Días sin ninguna comida registrada. */
  diasSinComidas: number;
  /** Días con check-in de bienestar completado. */
  diasConCheckin: number;
  registroPesoSemanal: boolean;
};

/**
 * Puntos de la semana según el documento. Las penalizaciones se calculan solo
 * sobre los días ya transcurridos: si es martes, no se castiga por las comidas
 * del viernes que todavía no llegó.
 */
export function calcularPuntosSemana(d: DatosSemana): DesgloseSemana {
  // ── Asistencia ──
  let asistencia = d.sesionesHechas * PUNTOS.asistencia.sesion;
  if (d.sesionesProgramadas > 0 && d.sesionesHechas >= d.sesionesProgramadas) {
    asistencia += PUNTOS.asistencia.semanaCompleta;
  }
  // Solo se cuentan como falta las sesiones que ya no se pueden recuperar:
  // se prorratean los días programados sobre los días transcurridos.
  const sesionesExigibles = Math.floor(
    (d.sesionesProgramadas * d.diasTranscurridos) / 7
  );
  const faltas = Math.max(0, sesionesExigibles - d.sesionesHechas);
  asistencia += faltas * PUNTOS.asistencia.falta;
  if (faltas >= 2) asistencia += PUNTOS.asistencia.extraDosFaltas;

  // ── Alimentación ──
  // Cada comida vale el día dividido por las comidas del plan del alumno.
  const comidasPorDia = Math.max(1, d.comidasPorDia);
  const valorComida = PUNTOS.alimentacion.puntosPorDia / comidasPorDia;
  const castigoComida = PUNTOS.alimentacion.castigoPorDia / comidasPorDia;

  const comidasExigibles = comidasPorDia * d.diasTranscurridos;
  let alimentacion = Math.round(d.comidasRegistradas * valorComida);
  alimentacion += d.diasCompletos * PUNTOS.alimentacion.diaCompleto;
  if (d.diasTranscurridos >= 7 && d.diasCompletos >= 7) {
    alimentacion += PUNTOS.alimentacion.semanaCompleta;
  }

  const comidasFaltantes = Math.max(0, comidasExigibles - d.comidasRegistradas);
  alimentacion += Math.round(comidasFaltantes * castigoComida);
  alimentacion += d.diasSinComidas * PUNTOS.alimentacion.extraDiaVacio;
  if (comidasExigibles > 0 && d.comidasRegistradas < comidasExigibles / 2) {
    alimentacion += PUNTOS.alimentacion.extraMenosDeLaMitad;
  }

  // ── App ──
  let app = d.diasConCheckin * (PUNTOS.app.ingresoDiario + PUNTOS.app.checkinDiario);
  const diasSinCheckin = Math.max(0, d.diasTranscurridos - d.diasConCheckin);
  app += diasSinCheckin * PUNTOS.app.sinCheckin;
  app += d.registroPesoSemanal ? PUNTOS.app.pesoSemanal : 0;
  if (d.diasTranscurridos >= 7 && !d.registroPesoSemanal) {
    app += PUNTOS.app.sinPesoSemanal;
  }

  const totalCrudo = asistencia + alimentacion + app;
  return { asistencia, alimentacion, app, total: Math.max(0, totalCrudo), totalCrudo };
}
