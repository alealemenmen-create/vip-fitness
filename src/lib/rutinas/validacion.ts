import {
  esPressPecho,
  patronMovimiento,
  type PatronMovimiento,
} from "./patrones";

export type EjercicioAuditable = {
  nombre: string;
  series: number;
  grupoMuscular: string | null;
  /** Dato estructurado de la galería. Si falta (PDF o rutina antigua), se
   * conserva la heurística por nombre como respaldo. */
  patronMovimiento?: PatronMovimiento | null;
};

export type DiaAuditable = {
  nombre: string;
  tipo?: string | null;
  ejercicios: EjercicioAuditable[];
};

export type HallazgoRutina = {
  codigo: string;
  mensaje: string;
  severidad: "error" | "aviso";
  /** null significa que el problema es semanal, no de una sesión puntual. */
  diaIndice: number | null;
  ejercicioIndices: number[];
  /** Abre la biblioteca ya filtrada por lo que falta. */
  grupoSugerido?: string;
  patronSugerido?: PatronMovimiento;
};

function normalizar(texto: string | null): string {
  return (texto ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function patronDe(ejercicio: EjercicioAuditable): PatronMovimiento {
  return ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular);
}

export function subgrupoBrazo(ejercicio: EjercicioAuditable): "biceps" | "triceps" | null {
  const patron = patronDe(ejercicio);
  if (patron.startsWith("triceps_")) return "triceps";
  if (patron.startsWith("biceps_")) return "biceps";
  const texto = `${normalizar(ejercicio.grupoMuscular)} ${normalizar(ejercicio.nombre)}`;
  if (["triceps", "extension", "press frances", "press cerrado", "fondos", "patada"].some((p) => texto.includes(p))) return "triceps";
  if (["biceps", "curl", "predicador", "martillo"].some((p) => texto.includes(p))) return "biceps";
  return null;
}

/** Control de calidad estructurado para poder advertir MIENTRAS se arma y
 * llevar al entrenador al día/ejercicio exacto. La publicación usa los mismos
 * hallazgos: no hay dos criterios distintos entre la mesa y el servidor. */
export function detectarHallazgosRutina(dias: DiaAuditable[]): HallazgoRutina[] {
  const hallazgos: HallazgoRutina[] = [];
  let biceps = 0;
  let triceps = 0;
  let seriesBiceps = 0;
  let seriesTriceps = 0;
  const seriesPorGrupo = new Map<string, number>();

  const agregar = (hallazgo: HallazgoRutina) => hallazgos.push(hallazgo);

  dias.forEach((dia, diaIndice) => {
    if (!dia.nombre.trim()) {
      agregar({ codigo: "sesion_sin_nombre", mensaje: `La sesión ${diaIndice + 1} necesita un nombre.`, severidad: "error", diaIndice, ejercicioIndices: [] });
    }
    if ((dia.tipo ?? "entrenamiento") === "entrenamiento" && dia.ejercicios.length === 0) {
      agregar({ codigo: "dia_vacio", mensaje: `La sesión "${dia.nombre}" no tiene ejercicios.`, severidad: "error", diaIndice, ejercicioIndices: [] });
    }
    if (dia.ejercicios.length > 10) {
      agregar({ codigo: "demasiados_ejercicios", mensaje: `La sesión "${dia.nombre}" tiene ${dia.ejercicios.length} ejercicios; el máximo seguro de publicación es 10.`, severidad: "error", diaIndice, ejercicioIndices: dia.ejercicios.map((_, i) => i) });
    }

    const nombresVistos = new Map<string, number>();
    const patronesPorGrupo = new Map<string, { patron: PatronMovimiento; indice: number }[]>();
    dia.ejercicios.forEach((ejercicio, ejercicioIndice) => {
      const grupo = normalizar(ejercicio.grupoMuscular);
      const series = Math.max(0, Number(ejercicio.series) || 0);
      const nombreNormalizado = normalizar(ejercicio.nombre);
      if (!nombreNormalizado) {
        agregar({ codigo: "ejercicio_sin_nombre", mensaje: `Hay un ejercicio sin elegir en la sesión "${dia.nombre || diaIndice + 1}".`, severidad: "error", diaIndice, ejercicioIndices: [ejercicioIndice], grupoSugerido: ejercicio.grupoMuscular ?? undefined });
      }
      if (!Number.isFinite(ejercicio.series) || ejercicio.series <= 0) {
        agregar({ codigo: "series_invalidas", mensaje: `"${ejercicio.nombre || `Ejercicio ${ejercicioIndice + 1}`}" necesita un número de series válido.`, severidad: "error", diaIndice, ejercicioIndices: [ejercicioIndice] });
      }
      const repetido = nombresVistos.get(nombreNormalizado);
      if (nombreNormalizado && repetido !== undefined) {
        agregar({ codigo: "ejercicio_repetido", mensaje: `La sesión "${dia.nombre}" repite exactamente "${ejercicio.nombre}".`, severidad: "error", diaIndice, ejercicioIndices: [repetido, ejercicioIndice] });
      }
      if (nombreNormalizado) nombresVistos.set(nombreNormalizado, ejercicioIndice);
      if (grupo && grupo !== "cardio") {
        const patrones = patronesPorGrupo.get(grupo) ?? [];
        patrones.push({ patron: patronDe(ejercicio), indice: ejercicioIndice });
        patronesPorGrupo.set(grupo, patrones);
      }
      if (grupo && grupo !== "cardio" && grupo !== "brazos") {
        seriesPorGrupo.set(grupo, (seriesPorGrupo.get(grupo) ?? 0) + series);
      }
      const subgrupo = subgrupoBrazo(ejercicio);
      if (subgrupo === "biceps") {
        biceps += 1;
        seriesBiceps += series;
      } else if (subgrupo === "triceps") {
        triceps += 1;
        seriesTriceps += series;
      }
    });

    const pecho = patronesPorGrupo.get("pecho") ?? [];
    const pressesPecho = pecho.filter((p) => esPressPecho(p.patron));
    const aislamientosPecho = pecho.filter((p) => p.patron === "pecho_aislamiento");
    if (pecho.length >= 2 && pressesPecho.length === 0) {
      agregar({ codigo: "pecho_sin_press", mensaje: `La sesión "${dia.nombre}" trabaja pecho sin ningún press; aperturas y cruces complementan, pero no sustituyen la base de empuje.`, severidad: "error", diaIndice, ejercicioIndices: pecho.map((p) => p.indice), grupoSugerido: "pecho", patronSugerido: "pecho_press_horizontal" });
    } else if (pecho.length >= 3 && pressesPecho.length < 2 && aislamientosPecho.length >= 2) {
      agregar({ codigo: "pecho_sin_segunda_base", mensaje: `La sesión "${dia.nombre}" tiene ${aislamientosPecho.length} aislamientos de pecho y solo ${pressesPecho.length} press; falta una segunda base de empuje.`, severidad: "error", diaIndice, ejercicioIndices: aislamientosPecho.map((p) => p.indice), grupoSugerido: "pecho", patronSugerido: "pecho_press_inclinado" });
    }

    const espalda = patronesPorGrupo.get("espalda") ?? [];
    const jalones = espalda.filter((p) => p.patron === "espalda_traccion_vertical");
    const remos = espalda.filter((p) => p.patron === "espalda_remo_horizontal");
    if (espalda.length >= 3 && (jalones.length === 0 || remos.length === 0)) {
      agregar({ codigo: "espalda_incompleta", mensaje: `La sesión "${dia.nombre}" no cubre la espalda completa: requiere al menos una tracción vertical y un remo horizontal antes de sumar lumbares, trapecio o accesorios.`, severidad: "error", diaIndice, ejercicioIndices: espalda.map((p) => p.indice), grupoSugerido: "espalda", patronSugerido: remos.length === 0 ? "espalda_remo_horizontal" : "espalda_traccion_vertical" });
    } else if (jalones.length >= 2 && remos.length === 0) {
      agregar({ codigo: "jalon_repetido", mensaje: `La sesión "${dia.nombre}" repite ${jalones.length} variantes de jalón sin incluir un remo; cambiar el agarre no reemplaza el patrón horizontal.`, severidad: "error", diaIndice, ejercicioIndices: jalones.map((p) => p.indice), grupoSugerido: "espalda", patronSugerido: "espalda_remo_horizontal" });
    }

    const hombros = patronesPorGrupo.get("hombros") ?? [];
    if (hombros.length >= 3 && normalizar(dia.nombre).includes("hombro")) {
      const cobertura = new Set(hombros.map((p) => p.patron));
      const requeridos: PatronMovimiento[] = ["hombro_press_vertical", "hombro_lateral", "hombro_posterior"];
      const faltante = requeridos.find((p) => !cobertura.has(p));
      if (faltante) {
        agregar({ codigo: "hombros_incompletos", mensaje: `La sesión "${dia.nombre}" debe cubrir press vertical, deltoide lateral y deltoide posterior antes de repetir variantes.`, severidad: "error", diaIndice, ejercicioIndices: hombros.map((p) => p.indice), grupoSugerido: "hombros", patronSugerido: faltante });
      }
    }

    const brazos = patronesPorGrupo.get("brazos") ?? [];
    const overhead = brazos.filter((p) => p.patron === "triceps_sobre_cabeza");
    if (overhead.length >= 2) {
      agregar({ codigo: "triceps_overhead_repetido", mensaje: `La sesión "${dia.nombre}" repite ${overhead.length} extensiones de tríceps sobre la cabeza; son el mismo patrón aunque cambie la traducción o el implemento.`, severidad: "error", diaIndice, ejercicioIndices: overhead.map((p) => p.indice), grupoSugerido: "brazos", patronSugerido: "triceps_polea_abajo" });
    }
  });

  if (biceps + triceps >= 4 && Math.min(biceps, triceps) < 2) {
    agregar({ codigo: "brazos_desbalanceados", mensaje: `Trabajo de brazos desbalanceado: ${biceps} ejercicio${biceps === 1 ? "" : "s"} de bíceps y ${triceps} de tríceps; se requieren al menos 2 de cada uno en una semana con 4 o más ejercicios directos.`, severidad: "error", diaIndice: null, ejercicioIndices: [], grupoSugerido: "brazos", patronSugerido: biceps < 2 ? "biceps_supinado" : "triceps_polea_abajo" });
  }
  if (seriesBiceps > 24) agregar({ codigo: "volumen_biceps", mensaje: `Bíceps acumula ${seriesBiceps} series directas; el máximo de publicación es 24.`, severidad: "error", diaIndice: null, ejercicioIndices: [] });
  if (seriesTriceps > 24) agregar({ codigo: "volumen_triceps", mensaje: `Tríceps acumula ${seriesTriceps} series directas; el máximo de publicación es 24.`, severidad: "error", diaIndice: null, ejercicioIndices: [] });
  for (const [grupo, series] of seriesPorGrupo) {
    const maximoCritico = grupo === "piernas" ? 50 : 36;
    if (series > maximoCritico) agregar({ codigo: `volumen_${grupo}`, mensaje: `${grupo} acumula ${series} series directas; supera el límite crítico de ${maximoCritico}.`, severidad: "error", diaIndice: null, ejercicioIndices: [], grupoSugerido: grupo });
  }

  const unicos = new Map<string, HallazgoRutina>();
  for (const hallazgo of hallazgos) {
    const clave = `${hallazgo.codigo}:${hallazgo.diaIndice ?? "semana"}:${hallazgo.mensaje}`;
    if (!unicos.has(clave)) unicos.set(clave, hallazgo);
  }
  return [...unicos.values()];
}

/** Compatibilidad para el servidor y las pruebas anteriores. */
export function detectarDeficienciasRutina(dias: DiaAuditable[]): string[] {
  return detectarHallazgosRutina(dias)
    .filter((hallazgo) => hallazgo.severidad === "error")
    .map((hallazgo) => hallazgo.mensaje);
}
