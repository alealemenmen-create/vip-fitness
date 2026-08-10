import type { BriefGenerador, GrupoEntrenable, PerfilEntrenamiento, RutinaGenerada } from "./tipos";

export type ResumenGrupoSemanal = {
  ejercicios: number;
  series: number;
  sesiones: number;
};

export type ResumenSemana = Record<GrupoEntrenable | "biceps" | "triceps", ResumenGrupoSemanal>;

const GRUPOS: Array<keyof ResumenSemana> = ["pecho", "espalda", "piernas", "hombros", "brazos", "core", "biceps", "triceps"];

function vacio(): ResumenSemana {
  return Object.fromEntries(GRUPOS.map((g) => [g, { ejercicios: 0, series: 0, sesiones: 0 }])) as ResumenSemana;
}

function subGrupoBrazo(nombre: string): "biceps" | "triceps" | null {
  const n = nombre.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (["triceps", "extension", "press frances", "press cerrado", "fondos", "patada"].some((p) => n.includes(p))) return "triceps";
  if (["biceps", "curl", "predicador", "martillo"].some((p) => n.includes(p))) return "biceps";
  return null;
}

export function resumirSemana(rutina: RutinaGenerada): ResumenSemana {
  const resumen = vacio();
  for (const dia of rutina.dias) {
    const presentes = new Set<keyof ResumenSemana>();
    for (const ejercicio of dia.ejercicios) {
      if (ejercicio.grupoMuscular === "cardio") continue;
      const grupo = ejercicio.grupoMuscular as GrupoEntrenable;
      resumen[grupo].ejercicios += 1;
      resumen[grupo].series += ejercicio.series;
      presentes.add(grupo);
      if (grupo === "brazos") {
        const subgrupo = subGrupoBrazo(ejercicio.nombre);
        if (subgrupo) {
          resumen[subgrupo].ejercicios += 1;
          resumen[subgrupo].series += ejercicio.series;
          presentes.add(subgrupo);
        }
      }
    }
    presentes.forEach((grupo) => { resumen[grupo].sesiones += 1; });
  }
  return resumen;
}

/** Segunda barrera determinista sobre la semana ya construida. El motor puede
 * elegir bien cada día y aun así dejar un hueco semanal; esta pasada mira el
 * conjunto antes de entregarlo al entrenador. Son alertas, no diagnósticos. */
export function validarSemanaVip(
  rutina: RutinaGenerada,
  brief: BriefGenerador,
  perfil: PerfilEntrenamiento
): { alertas: string[]; reglaResumen: string; resumen: ResumenSemana } {
  const resumen = resumirSemana(rutina);
  const alertas: string[] = [];
  const esperados = new Set<GrupoEntrenable>();
  for (const dia of rutina.dias) {
    for (const ejercicio of dia.ejercicios) {
      if (ejercicio.grupoMuscular !== "cardio") esperados.add(ejercicio.grupoMuscular as GrupoEntrenable);
    }
  }

  // En estructuras automáticas no especializadas se espera cobertura global.
  if (brief.distribucion !== "personalizada" && brief.dias >= 3) {
    (["pecho", "espalda", "piernas", "hombros", "brazos"] as GrupoEntrenable[]).forEach((g) => esperados.add(g));
  }

  for (const grupo of esperados) {
    const dato = resumen[grupo];
    if (dato.ejercicios === 0) alertas.push(`Cobertura semanal: ${grupo} no tiene ningún ejercicio.`);
    // "brazos" suma bíceps + tríceps: compararlo con el mismo techo de pecho
    // hacía saltar una falsa alarma con 18+19 series, aunque cada músculo por
    // separado estuviera dentro de rango. Los subgrupos se controlan abajo.
    if (grupo !== "brazos" && dato.series > 30) alertas.push(`Cobertura semanal: ${grupo} acumula ${dato.series} series directas; revisa si el volumen y la recuperación son razonables.`);
  }

  if (resumen.brazos.ejercicios > 0) {
    if (resumen.biceps.ejercicios === 0) alertas.push("Cobertura semanal: hay trabajo de brazos, pero ningún ejercicio de bíceps identificado.");
    if (resumen.triceps.ejercicios === 0) alertas.push("Cobertura semanal: hay trabajo de brazos, pero ningún ejercicio de tríceps identificado.");
    if (resumen.brazos.ejercicios >= 4 && Math.min(resumen.biceps.ejercicios, resumen.triceps.ejercicios) < 2) {
      alertas.push(`Cobertura semanal de brazos desbalanceada: ${resumen.biceps.ejercicios} ejercicio${resumen.biceps.ejercicios === 1 ? "" : "s"} de bíceps y ${resumen.triceps.ejercicios} de tríceps.`);
    }
    for (const grupo of ["biceps", "triceps"] as const) {
      if (resumen[grupo].series > 24) {
        alertas.push(`Cobertura semanal: ${grupo} acumula ${resumen[grupo].series} series directas; revisa si el volumen y la recuperación son razonables.`);
      }
    }
  }

  const minimoSeries = perfil.experiencia === "avanzado" ? 8 : perfil.experiencia === "intermedio" ? 6 : 4;
  for (const grupo of (["pecho", "espalda", "piernas", "hombros"] as GrupoEntrenable[])) {
    const dato = resumen[grupo];
    if (esperados.has(grupo) && dato.series > 0 && dato.series < minimoSeries) {
      alertas.push(`Cobertura semanal: ${grupo} suma solo ${dato.series} series directas para nivel ${perfil.experiencia ?? "principiante"}; revisa si cumple la intención del bloque.`);
    }
  }

  const reglaResumen = `Semana validada: ${rutina.dias.length} días · ${rutina.dias.reduce((n, d) => n + d.ejercicios.filter((e) => e.grupoMuscular !== "cardio").length, 0)} ejercicios de fuerza · cobertura y volumen directo revisados`;
  return { alertas: [...new Set(alertas)], reglaResumen, resumen };
}
