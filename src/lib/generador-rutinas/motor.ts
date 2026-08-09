import type {
  BriefGenerador,
  EjercicioBorrador,
  EjercicioGenerador,
  PerfilEntrenamiento,
  RutinaGenerada,
} from "./tipos";

const NIVEL = { principiante: 0, intermedio: 1, avanzado: 2 } as const;

const NOMBRES_DIA: Record<string, string[]> = {
  full_body: ["Cuerpo completo A", "Cuerpo completo B", "Cuerpo completo C", "Cuerpo completo D"],
  upper_lower: ["Tren superior A", "Tren inferior A", "Tren superior B", "Tren inferior B"],
  push_pull_legs: ["Empuje", "Tracción", "Piernas", "Empuje B", "Tracción B", "Piernas B"],
};

function distribucionReal(brief: BriefGenerador): Exclude<BriefGenerador["distribucion"], "automatica"> {
  if (brief.distribucion !== "automatica") return brief.distribucion;
  if (brief.dias <= 3) return "full_body";
  if (brief.dias === 4) return "upper_lower";
  return "push_pull_legs";
}

function correspondeDia(e: EjercicioGenerador, distribucion: string, indice: number): boolean {
  if (distribucion === "full_body") return e.grupoMuscular !== "cardio";
  if (distribucion === "upper_lower") {
    const inferior = indice % 2 === 1;
    return inferior ? e.grupoMuscular === "piernas" || e.grupoMuscular === "core" : !["piernas", "cardio"].includes(e.grupoMuscular);
  }
  const grupo = indice % 3;
  if (grupo === 0) return e.categoria === "empuje" || ["pecho", "hombros"].includes(e.grupoMuscular);
  if (grupo === 1) return e.categoria === "traccion" || ["espalda", "brazos"].includes(e.grupoMuscular);
  return e.grupoMuscular === "piernas" || e.grupoMuscular === "core";
}

function puntaje(e: EjercicioGenerador, brief: BriefGenerador, usados: Set<string>): number {
  let p = 0;
  if (brief.obligatorios.includes(e.id)) p += 1000;
  if (brief.preferidos.includes(e.id)) p += 80;
  if (!usados.has(e.id)) p += 25;
  if (e.posicionSesion === "principal") p += 20;
  if (brief.soloMaquinas && ["maquina", "polea", "smith"].includes(e.equipo)) p += 30;
  if (brief.prioridad === "fuerza" && ["barra", "smith"].includes(e.equipo)) p += 15;
  if (brief.prioridad === "adherencia" && e.complejidad === "baja") p += 15;
  return p;
}

function prescripcion(brief: BriefGenerador, e: EjercicioGenerador): Pick<EjercicioBorrador, "series" | "reps" | "descansoSegundos"> {
  const principal = e.posicionSesion === "principal" || ["empuje", "traccion", "pierna", "full_body"].includes(e.categoria);
  if (brief.prioridad === "fuerza") return { series: principal ? 3 : 2, reps: principal ? "4-6" : "8-10", descansoSegundos: principal ? 120 : 75 };
  if (brief.prioridad === "hipertrofia") return { series: 3, reps: principal ? "8-12" : "10-15", descansoSegundos: principal ? 90 : 60 };
  if (brief.prioridad === "retorno" || brief.prioridad === "tecnica") return { series: 2, reps: "10-12", descansoSegundos: 90 };
  return { series: principal ? 3 : 2, reps: "10-15", descansoSegundos: principal ? 90 : 60 };
}

export function generarRutinaPorReglas(
  perfil: PerfilEntrenamiento,
  brief: BriefGenerador,
  biblioteca: EjercicioGenerador[]
): RutinaGenerada {
  const alertas: string[] = [];
  const reglasAplicadas = ["Solo ejercicios activos de la biblioteca VIP", "Cardio ubicado al final", "Publicación sujeta a aprobación del entrenador"];
  if (perfil.requiereRevision || perfil.lesionesDiagnosticadas || perfil.condicionesMedicas) {
    alertas.push("El perfil contiene antecedentes que requieren revisión del entrenador antes de publicar.");
  }

  const maxNivel = NIVEL[perfil.experiencia ?? "principiante"];
  const prohibidos = new Set(brief.prohibidos);
  let candidatos = biblioteca.filter((e) => {
    if (prohibidos.has(e.id) || e.grupoMuscular === "cardio") return false;
    if (NIVEL[e.nivel] > maxNivel) return false;
    if (brief.evitarSaltos && (e.requiereSalto || e.impacto === "alto")) return false;
    if (brief.soloMaquinas && !["maquina", "polea", "smith"].includes(e.equipo)) return false;
    return true;
  });

  const obligatoriosValidos = biblioteca.filter((e) => brief.obligatorios.includes(e.id) && !prohibidos.has(e.id));
  candidatos = [...obligatoriosValidos, ...candidatos.filter((e) => !brief.obligatorios.includes(e.id))];
  if (candidatos.length === 0) throw new Error("No hay ejercicios compatibles con todos los filtros elegidos.");

  const distribucion = distribucionReal(brief);
  reglasAplicadas.push(`Distribución ${distribucion.replaceAll("_", " ")}`);
  if (brief.evitarSaltos) reglasAplicadas.push("Sin ejercicios de salto o impacto alto");
  if (brief.soloMaquinas) reglasAplicadas.push("Solo máquinas, poleas y Smith");

  const usados = new Set<string>();
  const dias = Array.from({ length: brief.dias }, (_, indice) => {
    const delDia = candidatos
      .filter((e) => correspondeDia(e, distribucion, indice))
      .sort((a, b) => puntaje(b, brief, usados) - puntaje(a, brief, usados));
    const elegidos = delDia.slice(0, brief.ejerciciosPorSesion);
    if (elegidos.length < brief.ejerciciosPorSesion) {
      const extras = candidatos.filter((e) => !elegidos.some((x) => x.id === e.id)).slice(0, brief.ejerciciosPorSesion - elegidos.length);
      elegidos.push(...extras);
    }

    const ejercicios: EjercicioBorrador[] = elegidos.map((e, i) => {
      usados.add(e.id);
      return {
        orden: i + 1,
        ejercicioId: e.id,
        nombre: e.nombre,
        ...prescripcion(brief, e),
        tecnicaTipo: null,
        tecnicaInstruccion: null,
        observacion: null,
        grupoMuscular: e.grupoMuscular,
      };
    });

    if (brief.abdominales) {
      const core = candidatos.find((e) => e.grupoMuscular === "core" && !ejercicios.some((x) => x.ejercicioId === e.id));
      if (core) ejercicios.push({ orden: ejercicios.length + 1, ejercicioId: core.id, nombre: core.nombre, ...prescripcion(brief, core), tecnicaTipo: null, tecnicaInstruccion: null, observacion: "Trabajo de core al finalizar la fuerza.", grupoMuscular: core.grupoMuscular });
    }
    const cardio = brief.cardio !== "ninguno"
      ? biblioteca.find(
          (e) =>
            e.grupoMuscular === "cardio" &&
            !prohibidos.has(e.id) &&
            (!brief.evitarSaltos || (!e.requiereSalto && e.impacto !== "alto"))
        )
      : null;
    if (cardio) ejercicios.push({ orden: ejercicios.length + 1, ejercicioId: cardio.id, nombre: cardio.nombre, series: 1, reps: `${brief.cardioMinutos} min`, descansoSegundos: 0, tecnicaTipo: null, tecnicaInstruccion: null, observacion: `Cardio ${brief.cardio} al finalizar.`, grupoMuscular: "cardio" });

    return { numero: indice + 1, nombre: NOMBRES_DIA[distribucion]?.[indice] ?? `Día ${indice + 1}`, tipo: "entrenamiento" as const, descripcion: null, ejercicios };
  });

  for (const id of brief.obligatorios) {
    if (!dias.some((d) => d.ejercicios.some((e) => e.ejercicioId === id))) alertas.push("Un ejercicio obligatorio no fue compatible con la distribución o filtros y debe revisarse.");
  }

  return { nombreRutina: `Plan ${brief.objetivo.replaceAll("_", " ")}`, dias, reglasAplicadas, alertas };
}
