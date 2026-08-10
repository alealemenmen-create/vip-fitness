import { esPressPecho, patronMovimiento, type PatronMovimiento } from "./patrones";

export type EjercicioAuditable = {
  nombre: string;
  series: number;
  grupoMuscular: string | null;
};

export type DiaAuditable = {
  nombre: string;
  tipo?: string | null;
  ejercicios: EjercicioAuditable[];
};

function normalizar(texto: string | null): string {
  return (texto ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function subgrupoBrazo(ejercicio: EjercicioAuditable): "biceps" | "triceps" | null {
  const texto = `${normalizar(ejercicio.grupoMuscular)} ${normalizar(ejercicio.nombre)}`;
  if (["triceps", "extension", "press frances", "press cerrado", "fondos", "patada"].some((p) => texto.includes(p))) return "triceps";
  if (["biceps", "curl", "predicador", "martillo"].some((p) => texto.includes(p))) return "biceps";
  return null;
}

/** Barrera crítica compartida por el generador, PDFs y auditoría histórica. */
export function detectarDeficienciasRutina(dias: DiaAuditable[]): string[] {
  const errores: string[] = [];
  let biceps = 0;
  let triceps = 0;
  let seriesBiceps = 0;
  let seriesTriceps = 0;
  const seriesPorGrupo = new Map<string, number>();

  for (const dia of dias) {
    if ((dia.tipo ?? "entrenamiento") === "entrenamiento" && dia.ejercicios.length === 0) {
      errores.push(`El día "${dia.nombre}" no tiene ejercicios.`);
    }
    if (dia.ejercicios.length > 10) {
      errores.push(`El día "${dia.nombre}" tiene ${dia.ejercicios.length} ejercicios; el máximo seguro de publicación es 10.`);
    }

    const nombresVistos = new Set<string>();
    const patronesPorGrupo = new Map<string, PatronMovimiento[]>();
    for (const ejercicio of dia.ejercicios) {
      const grupo = normalizar(ejercicio.grupoMuscular);
      const series = Math.max(0, Number(ejercicio.series) || 0);
      const nombreNormalizado = normalizar(ejercicio.nombre);
      if (nombreNormalizado && nombresVistos.has(nombreNormalizado)) {
        errores.push(`El día "${dia.nombre}" repite exactamente "${ejercicio.nombre}".`);
      }
      nombresVistos.add(nombreNormalizado);
      if (grupo && grupo !== "cardio") {
        const patrones = patronesPorGrupo.get(grupo) ?? [];
        patrones.push(patronMovimiento(ejercicio.nombre, grupo));
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
    }

    const pecho = patronesPorGrupo.get("pecho") ?? [];
    const pressesPecho = pecho.filter(esPressPecho).length;
    const aislamientosPecho = pecho.filter((p) => p === "pecho_aislamiento").length;
    if (pecho.length >= 2 && pressesPecho === 0) {
      errores.push(`El día "${dia.nombre}" trabaja pecho sin ningún press; aperturas y cruces complementan, pero no sustituyen la base de empuje.`);
    } else if (pecho.length >= 3 && pressesPecho < 2 && aislamientosPecho >= 2) {
      errores.push(`El día "${dia.nombre}" tiene ${aislamientosPecho} aislamientos de pecho y solo ${pressesPecho} press; falta una segunda base de empuje.`);
    }

    const espalda = patronesPorGrupo.get("espalda") ?? [];
    const jalones = espalda.filter((p) => p === "espalda_traccion_vertical").length;
    const remos = espalda.filter((p) => p === "espalda_remo_horizontal").length;
    if (espalda.length >= 3 && (jalones === 0 || remos === 0)) {
      errores.push(`El día "${dia.nombre}" no cubre la espalda completa: requiere al menos una tracción vertical y un remo horizontal antes de sumar lumbares, trapecio o accesorios.`);
    }
    if (jalones >= 2 && remos === 0) {
      errores.push(`El día "${dia.nombre}" repite ${jalones} variantes de jalón sin incluir un remo; cambiar el agarre no reemplaza el patrón horizontal.`);
    }

    const hombros = patronesPorGrupo.get("hombros") ?? [];
    if (hombros.length >= 3 && normalizar(dia.nombre).includes("hombro")) {
      const cobertura = new Set(hombros);
      if (!["hombro_press_vertical", "hombro_lateral", "hombro_posterior"].every((p) => cobertura.has(p as PatronMovimiento))) {
        errores.push(`El día "${dia.nombre}" debe cubrir press vertical, deltoide lateral y deltoide posterior antes de repetir variantes.`);
      }
    }

    const brazos = patronesPorGrupo.get("brazos") ?? [];
    const overhead = brazos.filter((p) => p === "triceps_sobre_cabeza").length;
    if (overhead >= 2) {
      errores.push(`El día "${dia.nombre}" repite ${overhead} extensiones de tríceps sobre la cabeza; son el mismo patrón aunque cambie la traducción o el implemento.`);
    }
  }

  if (biceps + triceps >= 4 && Math.min(biceps, triceps) < 2) {
    errores.push(`Trabajo de brazos desbalanceado: ${biceps} ejercicio${biceps === 1 ? "" : "s"} de bíceps y ${triceps} de tríceps; se requieren al menos 2 de cada uno en una semana con 4 o más ejercicios directos.`);
  }
  if (seriesBiceps > 24) errores.push(`Bíceps acumula ${seriesBiceps} series directas; el máximo de publicación es 24.`);
  if (seriesTriceps > 24) errores.push(`Tríceps acumula ${seriesTriceps} series directas; el máximo de publicación es 24.`);
  for (const [grupo, series] of seriesPorGrupo) {
    // Alejandro usa bloques intensivos y, especialmente en Wellness, una
    // frecuencia/volumen de piernas por encima del estándar puede ser
    // intencional. Esto es una barrera crítica, no una recomendación: el
    // validador semanal del generador ya alerta desde 30 sin bloquear.
    const maximoCritico = grupo === "piernas" ? 50 : 36;
    if (series > maximoCritico) errores.push(`${grupo} acumula ${series} series directas; supera el límite crítico de ${maximoCritico}.`);
  }

  return [...new Set(errores)];
}
