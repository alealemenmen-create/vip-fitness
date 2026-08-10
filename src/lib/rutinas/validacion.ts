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
    for (const ejercicio of dia.ejercicios) {
      const grupo = normalizar(ejercicio.grupoMuscular);
      const series = Math.max(0, Number(ejercicio.series) || 0);
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
