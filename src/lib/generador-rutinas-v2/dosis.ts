import { evaluarEntrevistaVipV2 } from "@/lib/generador-rutinas-v2/entrevista";
import { seleccionarOpcionDivisionVipV2 } from "@/lib/generador-rutinas-v2/divisiones";
import {
  GRUPOS_DOSIS_V2,
  type DivisionCompetitivaV2,
  type EntrevistaVipV2,
  type GrupoDosisV2,
  type NivelExperienciaV2,
  type ObjetivoVipV2,
} from "@/lib/generador-rutinas-v2/tipos";

export const VERSION_MOTOR_DOSIS_VIP_2 = 1 as const;

export type EstadoMotorDosisV2 = "no_disponible" | "provisional_revision" | "calculado";
export type CalidadRecuperacionV2 = "baja" | "moderada" | "buena";
export type PrioridadGrupoV2 = "mantenimiento" | "base" | "prioridad";

export type DosisGrupoV2 = {
  grupo: GrupoDosisV2;
  prioridad: PrioridadGrupoV2;
  seriesDirectasRecientes: number | null;
  seriesDirectasSemanales: {
    minimo: number;
    objetivo: number;
    maximoAutomatico: number;
  };
  frecuenciaSemanal: number;
  maximoPorSesion: number;
  cambioRespectoAlHistorialPorcentaje: number | null;
};

export type ResultadoMotorDosisV2 = {
  version: typeof VERSION_MOTOR_DOSIS_VIP_2;
  estado: EstadoMotorDosisV2;
  razones: string[];
  alertas: string[];
  nivelExperiencia: NivelExperienciaV2;
  recuperacion: {
    puntuacion: number | null;
    calidad: CalidadRecuperacionV2 | null;
    ajusteAplicado: string;
  };
  estructura: {
    diasRecomendados: number | null;
    diasSugeridosMotor: number | null;
    modoDistribucionDias: EntrevistaVipV2["recursos"]["modoDistribucionDias"];
    minutosPorSesion: number | null;
    capacidadSeriesTrabajoPorSesion: number | null;
    presupuestoSeriesDirectasSemanal: number | null;
  };
  intensidad: {
    rirCompuestos: readonly [number, number] | null;
    rirAislamientos: readonly [number, number] | null;
    fallo: "no_habilitado" | "limitado_aislamientos";
    descansoCompuestosSegundos: readonly [number, number] | null;
    descansoAislamientosSegundos: readonly [number, number] | null;
  };
  tecnicasAvanzadas: {
    estado: "no_habilitadas" | "limitadas";
    regla: string;
  };
  dosisPorGrupo: DosisGrupoV2[];
  cardio: string;
  progresion: string[];
  criteriosReduccion: string[];
  revisionCadaSemanas: number | null;
  supuestos: string[];
};

const GRUPOS_GRANDES = new Set<GrupoDosisV2>([
  "pecho",
  "espalda",
  "cuadriceps",
  "femorales",
  "gluteos",
]);

const PRIORIDADES_DIVISION: Partial<Record<DivisionCompetitivaV2, readonly GrupoDosisV2[]>> = {
  mens_open: ["pecho", "espalda", "hombros", "brazos", "cuadriceps", "femorales", "gluteos"],
  mens_212: ["espalda", "hombros", "brazos", "cuadriceps", "femorales"],
  classic_physique: ["pecho", "espalda", "hombros", "cuadriceps", "femorales"],
  mens_physique: ["espalda", "hombros", "pecho", "brazos"],
  mens_wheelchair: ["espalda", "hombros", "pecho", "brazos"],
  womens_bodybuilding: ["espalda", "hombros", "brazos", "cuadriceps", "femorales", "gluteos"],
  fitness: ["hombros", "espalda", "gluteos", "cuadriceps", "core"],
  figure: ["hombros", "espalda", "gluteos", "cuadriceps"],
  bikini: ["gluteos", "hombros", "femorales", "core"],
  womens_physique: ["hombros", "espalda", "brazos", "cuadriceps", "gluteos"],
  wellness: ["gluteos", "cuadriceps", "femorales", "pantorrillas"],
  fit_model: ["gluteos", "hombros", "espalda", "core"],
};

const PALABRAS_GRUPO: Record<GrupoDosisV2, readonly string[]> = {
  pecho: ["pecho", "pectoral"],
  espalda: ["espalda", "dorsal"],
  hombros: ["hombro", "deltoide"],
  brazos: ["brazo", "bíceps", "biceps", "tríceps", "triceps"],
  cuadriceps: ["cuádriceps", "cuadriceps"],
  femorales: ["femoral", "isquio"],
  gluteos: ["glúteo", "gluteo"],
  pantorrillas: ["pantorrilla", "gemelo"],
  core: ["core", "abdomen", "abdominal"],
};

const BASE_HIPERTROFIA: Record<NivelExperienciaV2, readonly [number, number]> = {
  novato: [6, 4],
  intermedio: [8, 5],
  avanzado: [10, 6],
  elite_profesional: [10, 7],
};

const MAXIMO_AUTOMATICO: Record<NivelExperienciaV2, number> = {
  novato: 10,
  intermedio: 14,
  avanzado: 18,
  elite_profesional: 20,
};

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

function redondear(valor: number, decimales = 1): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function puntuacionRecuperacion(entrevista: EntrevistaVipV2): number | null {
  const valores = [
    entrevista.recuperacion.sueno,
    entrevista.recuperacion.energia,
    entrevista.recuperacion.estres,
    entrevista.recuperacion.doms,
    entrevista.recuperacion.apetito,
  ].filter((valor): valor is NonNullable<typeof valor> => valor !== null);
  if (valores.length < 4) return null;
  return redondear(valores.reduce((total, valor) => total + valor, 0) / valores.length);
}

function calidadRecuperacion(puntuacion: number): CalidadRecuperacionV2 {
  if (puntuacion < 2.6) return "baja";
  if (puntuacion < 3.6) return "moderada";
  return "buena";
}

function gruposPrioritarios(entrevista: EntrevistaVipV2): Set<GrupoDosisV2> {
  const grupos = new Set<GrupoDosisV2>();
  if (entrevista.competencia.compite === "si" && entrevista.competencia.division) {
    for (const grupo of PRIORIDADES_DIVISION[entrevista.competencia.division] ?? []) grupos.add(grupo);
  }
  const puntosDebiles = entrevista.competencia.puntosDebiles.toLocaleLowerCase("es");
  for (const grupo of GRUPOS_DOSIS_V2) {
    if (PALABRAS_GRUPO[grupo].some((palabra) => puntosDebiles.includes(palabra))) grupos.add(grupo);
  }
  return grupos;
}

function basePorObjetivo(
  objetivo: ObjetivoVipV2,
  nivel: NivelExperienciaV2,
  grupo: GrupoDosisV2,
): number {
  const grande = GRUPOS_GRANDES.has(grupo);
  const [baseGrande, basePequena] = BASE_HIPERTROFIA[nivel];
  if (["hipertrofia", "recomposicion", "competencia"].includes(objetivo)) {
    return grande ? baseGrande : basePequena;
  }
  if (objetivo === "fuerza") return grande ? Math.max(5, baseGrande - 2) : Math.max(2, basePequena - 2);
  if (objetivo === "potencia" || objetivo === "rendimiento") return grande ? 5 : 3;
  return grande ? 4 : 2;
}

function factorHistorial(entrevista: EntrevistaVipV2, recuperacion: CalidadRecuperacionV2): number {
  let factor = recuperacion === "baja" ? 0.8 : 1;
  if (entrevista.dosisReciente.tendenciaRendimiento === "retroceso") factor *= 0.85;
  if (entrevista.dosisReciente.tendenciaRendimiento === "mejora" && recuperacion === "buena") factor *= 1.05;
  const adherencia = entrevista.dosisReciente.adherenciaPorcentaje;
  if (adherencia !== null && adherencia < 70) factor *= 0.85;
  else if (adherencia !== null && adherencia < 85) factor *= 0.95;
  return limitar(factor, 0.6, 1.2);
}

function diasRecomendados(
  entrevista: EntrevistaVipV2,
  nivel: NivelExperienciaV2,
  recuperacion: CalidadRecuperacionV2,
  requiereRevision: boolean,
): number {
  const disponibles = limitar(entrevista.recursos.diasReales ?? 1, 1, 7);
  const maximoNivel: Record<NivelExperienciaV2, number> = {
    novato: 3,
    intermedio: 4,
    avanzado: 5,
    elite_profesional: 6,
  };
  let maximo = maximoNivel[nivel];
  if (entrevista.dosisReciente.estadoHistorial === "retorno_sin_historial") maximo = Math.min(maximo, 3);
  if (recuperacion === "baja" || requiereRevision) maximo = Math.min(maximo, 3);
  return Math.min(disponibles, maximo);
}

function capacidadPorSesion(minutos: number, objetivo: ObjetivoVipV2): number {
  const minutosUtiles = Math.max(15, minutos - 12);
  const minutosPorSerie = objetivo === "fuerza" || objetivo === "potencia" ? 5 : 4;
  return limitar(Math.floor(minutosUtiles / minutosPorSerie), 4, 20);
}

function minimoGrupo(grupo: GrupoDosisV2, prioridad: boolean, preservarAccesorios = false): number {
  if (prioridad) return 4;
  if (preservarAccesorios && (grupo === "hombros" || grupo === "brazos")) return 2;
  return GRUPOS_GRANDES.has(grupo) ? 2 : 0;
}

function ajustarAlPresupuesto(
  objetivos: Record<GrupoDosisV2, number>,
  prioridades: Set<GrupoDosisV2>,
  presupuesto: number,
  preservarAccesorios: boolean,
): Record<GrupoDosisV2, number> {
  const total = GRUPOS_DOSIS_V2.reduce((suma, grupo) => suma + objetivos[grupo], 0);
  if (total <= presupuesto) return objetivos;

  const escala = presupuesto / total;
  const ajustado = Object.fromEntries(GRUPOS_DOSIS_V2.map((grupo) => [
    grupo,
    Math.max(minimoGrupo(grupo, prioridades.has(grupo), preservarAccesorios), Math.round(objetivos[grupo] * escala)),
  ])) as Record<GrupoDosisV2, number>;

  let exceso = GRUPOS_DOSIS_V2.reduce((suma, grupo) => suma + ajustado[grupo], 0) - presupuesto;
  const ordenReduccion = [...GRUPOS_DOSIS_V2].sort((a, b) => {
    const prioridadA = prioridades.has(a) ? 1 : 0;
    const prioridadB = prioridades.has(b) ? 1 : 0;
    return prioridadA - prioridadB || ajustado[b] - ajustado[a];
  });
  while (exceso > 0) {
    let cambio = false;
    for (const grupo of ordenReduccion) {
      const minimo = minimoGrupo(grupo, prioridades.has(grupo), preservarAccesorios);
      if (ajustado[grupo] > minimo) {
        ajustado[grupo] -= 1;
        exceso -= 1;
        cambio = true;
        if (exceso === 0) break;
      }
    }
    if (!cambio) break;
  }
  return ajustado;
}

function cambioPorcentaje(actual: number | null, objetivo: number): number | null {
  if (actual === null || actual === 0) return null;
  return Math.round(((objetivo - actual) / actual) * 100);
}

function funcionRequiereRevision(entrevista: EntrevistaVipV2): boolean {
  return Object.entries(entrevista.funcion)
    .filter(([campo]) => campo !== "ayudasTecnicas")
    .some(([, valor]) => valor === "limitado" || valor === "requiere_asistencia");
}

function resultadoNoDisponible(nivel: NivelExperienciaV2, razones: string[]): ResultadoMotorDosisV2 {
  return {
    version: VERSION_MOTOR_DOSIS_VIP_2,
    estado: "no_disponible",
    razones,
    alertas: [],
    nivelExperiencia: nivel,
    recuperacion: { puntuacion: null, calidad: null, ajusteAplicado: "Sin cálculo." },
    estructura: {
      diasRecomendados: null,
      diasSugeridosMotor: null,
      modoDistribucionDias: "recomendada",
      minutosPorSesion: null,
      capacidadSeriesTrabajoPorSesion: null,
      presupuestoSeriesDirectasSemanal: null,
    },
    intensidad: {
      rirCompuestos: null,
      rirAislamientos: null,
      fallo: "no_habilitado",
      descansoCompuestosSegundos: null,
      descansoAislamientosSegundos: null,
    },
    tecnicasAvanzadas: {
      estado: "no_habilitadas",
      regla: "No se habilitan técnicas sin una dosis válida.",
    },
    dosisPorGrupo: [],
    cardio: "No calculado.",
    progresion: [],
    criteriosReduccion: [],
    revisionCadaSemanas: null,
    supuestos: [],
  };
}

export function calcularDosisVipV2(entrevista: EntrevistaVipV2): ResultadoMotorDosisV2 {
  const evaluacion = evaluarEntrevistaVipV2(entrevista);
  const razonesFaltantes: string[] = [];
  if (!evaluacion.puedeCalcularDosis) razonesFaltantes.push(...evaluacion.razonesSeguridad, "La entrevista todavía no habilita el cálculo de dosis.");
  const puntuacion = puntuacionRecuperacion(entrevista);
  if (puntuacion === null) razonesFaltantes.push("Faltan al menos sueño, energía, estrés y dolor muscular.");
  if (!entrevista.recursos.diasReales || !entrevista.recursos.minutosSesion) razonesFaltantes.push("Faltan los días y minutos reales disponibles.");
  if (!entrevista.objetivo.principal) razonesFaltantes.push("Falta el objetivo principal.");
  if (razonesFaltantes.length > 0 || puntuacion === null || !entrevista.objetivo.principal) {
    return resultadoNoDisponible(evaluacion.nivelExperienciaCalculado, [...new Set(razonesFaltantes)]);
  }

  const nivel = evaluacion.nivelExperienciaCalculado;
  const calidad = calidadRecuperacion(puntuacion);
  const revisionFuncional = funcionRequiereRevision(entrevista);
  const jovenSinSupervision = entrevista.persona.etapaVida === "joven" && entrevista.recursos.supervision === "sin_supervision";
  const requiereRevision = evaluacion.estadoSeguridad === "requiere_revision" || revisionFuncional || jovenSinSupervision;
  const diasSugeridosMotor = diasRecomendados(entrevista, nivel, calidad, requiereRevision);
  const modoDistribucionDias = entrevista.recursos.modoDistribucionDias ?? "recomendada";
  const diasDisponibles = limitar(entrevista.recursos.diasReales ?? 1, 1, 7);
  const dias = modoDistribucionDias === "manual" ? diasDisponibles : diasSugeridosMotor;
  const minutos = entrevista.recursos.minutosSesion ?? 45;
  const capacidad = capacidadPorSesion(minutos, entrevista.objetivo.principal);
  // Elegir más días no aumenta por sí solo la dosis semanal. Si el entrenador
  // reparte una dosis recomendada de 3 días en 5, conserva el presupuesto de
  // 3 y obtiene sesiones más breves. Elegir menos días sí reduce el presupuesto
  // para que la semana siga cabiendo en el tiempo real disponible.
  const presupuesto = capacidad * Math.min(dias, diasSugeridosMotor);
  const prioridades = gruposPrioritarios(entrevista);
  const factor = factorHistorial(entrevista, calidad);
  const alertas: string[] = [];
  const supuestos: string[] = [
    "Las cifras representan series directas de trabajo; el constructor de ejercicios deberá contabilizar también la carga indirecta.",
    "El presupuesto reserva aproximadamente 12 minutos de la sesión para preparación, transiciones y cierre.",
  ];

  if (entrevista.persona.modalidad === "grupal") {
    alertas.push("La dosis pertenece solo a esta persona: en dupla o grupo no se comparten volumen, carga, RIR ni progresión.");
  }
  if (revisionFuncional) alertas.push("Hay una función limitada o asistida; la selección y adaptación de ejercicios requiere revisión.");
  if (jovenSinSupervision) alertas.push("Una persona joven sin supervisión no puede recibir una prescripción automática final.");
  if (calidad === "baja") alertas.push("La recuperación actual obliga a reducir la dosis y conservar más repeticiones en reserva.");
  if (entrevista.dosisReciente.tendenciaRendimiento === "retroceso") alertas.push("El rendimiento reciente retrocede; no se autoriza aumentar volumen.");
  if ((entrevista.dosisReciente.adherenciaPorcentaje ?? 100) < 70) alertas.push("La adherencia es menor a 70%; primero se simplifica la rutina.");
  if (entrevista.recursos.diasReales === 1) alertas.push("Un solo día limita la distribución; se priorizarán patrones globales en la siguiente etapa.");
  if (modoDistribucionDias === "manual" && dias !== diasSugeridosMotor) {
    alertas.push(`Distribución manual: se programarán ${dias} días; el motor sugería ${diasSugeridosMotor}. La dosis semanal no aumenta por añadir sesiones.`);
  }

  const tieneHistorial = entrevista.dosisReciente.estadoHistorial === "con_historial";
  const esWheelchair = entrevista.competencia.compite === "si" && entrevista.competencia.division === "mens_wheelchair";
  const preservarAccesorios = dias >= 4
    && ["hipertrofia", "recomposicion", "competencia"].includes(entrevista.objetivo.principal);
  const objetivosSinPresupuesto = Object.fromEntries(GRUPOS_DOSIS_V2.map((grupo) => {
    if (esWheelchair && ["cuadriceps", "femorales", "gluteos", "pantorrillas"].includes(grupo)) return [grupo, 0];
    const actual = tieneHistorial ? entrevista.dosisReciente.seriesPorGrupo[grupo] : null;
    let objetivo = actual !== null
      ? Math.round(actual * factor)
      : basePorObjetivo(entrevista.objetivo.principal!, nivel, grupo);
    if (prioridades.has(grupo) && nivel !== "novato" && calidad !== "baja") objetivo += 2;
    const maximoNivel = MAXIMO_AUTOMATICO[nivel] - (GRUPOS_GRANDES.has(grupo) ? 0 : 2);
    if (actual !== null && actual > maximoNivel) {
      alertas.push(`${grupo}: el historial declara ${actual} series directas; supera el límite automático y requiere auditoría.`);
    }
    objetivo = limitar(objetivo, minimoGrupo(grupo, prioridades.has(grupo), preservarAccesorios), maximoNivel);
    if (actual !== null && objetivo > actual) objetivo = Math.min(objetivo, Math.ceil(actual * 1.2));
    return [grupo, objetivo];
  })) as Record<GrupoDosisV2, number>;

  const totalAntes = GRUPOS_DOSIS_V2.reduce((suma, grupo) => suma + objetivosSinPresupuesto[grupo], 0);
  const objetivos = ajustarAlPresupuesto(objetivosSinPresupuesto, prioridades, presupuesto, preservarAccesorios);
  if (totalAntes > presupuesto) {
    alertas.push(`La dosis solicitada no cabe en ${dias} sesiones de ${minutos} minutos; se ajustó al presupuesto recuperable de ${presupuesto} series directas.`);
  }

  const maximoSesionNivel: Record<NivelExperienciaV2, number> = {
    novato: 5,
    intermedio: 7,
    avanzado: 9,
    elite_profesional: 10,
  };
  const divisionSemanal = seleccionarOpcionDivisionVipV2(entrevista, dias);
  const dosisPorGrupo: DosisGrupoV2[] = GRUPOS_DOSIS_V2.map((grupo) => {
    const objetivo = objetivos[grupo];
    const actual = tieneHistorial ? entrevista.dosisReciente.seriesPorGrupo[grupo] : null;
    const prioridad: PrioridadGrupoV2 = prioridades.has(grupo)
      ? "prioridad"
      : objetivo <= (GRUPOS_GRANDES.has(grupo) ? 2 : 1) ? "mantenimiento" : "base";
    const maximoSesion = maximoSesionNivel[nivel];
    let frecuencia = objetivo === 0 ? 0 : 1;
    if (dias >= 2 && objetivo >= 6) frecuencia = 2;
    if (dias >= 4 && objetivo >= 4 && GRUPOS_GRANDES.has(grupo)) frecuencia = 2;
    // En divisiones de cuatro o más días, cuatro series directas de
    // hombros o brazos se reparten en dos exposiciones breves. Esto permite
    // ordenar tríceps con empuje y bíceps con tracción sin aumentar volumen.
    if (dias >= 4 && objetivo >= 2 && (grupo === "hombros" || grupo === "brazos")) frecuencia = 2;
    if (dias >= 3 && objetivo > maximoSesion * 2) frecuencia = 3;
    const cuposDivision = divisionSemanal.dias.filter((dia) => dia.grupos.includes(grupo)).length;
    frecuencia = Math.min(dias, cuposDivision, frecuencia);
    const maximoPorSesion = frecuencia === 0 ? 0 : Math.min(maximoSesion, Math.ceil(objetivo / frecuencia) + 1);
    const maximoPorHistorial = actual !== null && actual > 0 ? Math.ceil(actual * 1.2) : MAXIMO_AUTOMATICO[nivel];
    return {
      grupo,
      prioridad,
      seriesDirectasRecientes: actual,
      seriesDirectasSemanales: {
        minimo: Math.max(minimoGrupo(grupo, prioridades.has(grupo), preservarAccesorios), objetivo - 2),
        objetivo,
        maximoAutomatico: Math.min(MAXIMO_AUTOMATICO[nivel], maximoPorHistorial, objetivo + 2),
      },
      frecuenciaSemanal: frecuencia,
      maximoPorSesion,
      cambioRespectoAlHistorialPorcentaje: cambioPorcentaje(actual, objetivo),
    };
  });

  const conservador = calidad === "baja" || requiereRevision || entrevista.objetivo.principal === "perdida_grasa";
  const rirCompuestos: readonly [number, number] = nivel === "novato" || conservador ? [3, 4] : [2, 3];
  const rirAislamientos: readonly [number, number] = nivel === "novato" || conservador ? [2, 3] : [1, 2];
  const fuerzaPotencia = entrevista.objetivo.principal === "fuerza" || entrevista.objetivo.principal === "potencia";
  const tecnicasPermitidas = !requiereRevision
    && calidad === "buena"
    && (nivel === "avanzado" || nivel === "elite_profesional");
  const falloLimitado = tecnicasPermitidas && entrevista.preferencias.estiloComoInfluencia !== "ninguna";

  if (entrevista.preferencias.estiloComoInfluencia === "hit" && !falloLimitado) {
    alertas.push("La preferencia HIT se conserva como influencia, pero no habilita fallo mientras el perfil o la recuperación no lo permitan.");
  }
  if (entrevista.objetivo.principal === "perdida_grasa") {
    alertas.push("La pérdida de grasa no añade circuitos de vaciado, fallo ni cardio terminal al presupuesto de fuerza.");
  }

  return {
    version: VERSION_MOTOR_DOSIS_VIP_2,
    estado: requiereRevision ? "provisional_revision" : "calculado",
    razones: requiereRevision
      ? [...evaluacion.razonesSeguridad, "La dosis es provisional hasta revisar las adaptaciones indicadas."]
      : ["La puerta de seguridad y los datos mínimos permiten calcular una dosis de trabajo."],
    alertas: [...new Set(alertas)],
    nivelExperiencia: nivel,
    recuperacion: {
      puntuacion,
      calidad,
      ajusteAplicado: calidad === "baja"
        ? "Reducción conservadora por recuperación baja."
        : calidad === "buena" && entrevista.dosisReciente.tendenciaRendimiento === "mejora"
          ? "Aumento pequeño, limitado a un máximo de 20% respecto del historial."
          : "Dosis estable; no se aumenta volumen sin una señal favorable.",
    },
    estructura: {
      diasRecomendados: dias,
      diasSugeridosMotor,
      modoDistribucionDias,
      minutosPorSesion: minutos,
      capacidadSeriesTrabajoPorSesion: capacidad,
      presupuestoSeriesDirectasSemanal: presupuesto,
    },
    intensidad: {
      rirCompuestos,
      rirAislamientos,
      fallo: falloLimitado ? "limitado_aislamientos" : "no_habilitado",
      descansoCompuestosSegundos: fuerzaPotencia ? [180, 300] : [120, 180],
      descansoAislamientosSegundos: [60, 90],
    },
    tecnicasAvanzadas: {
      estado: tecnicasPermitidas ? "limitadas" : "no_habilitadas",
      regla: tecnicasPermitidas
        ? "Máximo una técnica avanzada en la sesión, reemplazando volumen convencional y nunca como obligación diaria."
        : "Primero se consolidan técnica, recuperación y progresión convencional.",
    },
    dosisPorGrupo,
    cardio: "Se calcula en un módulo separado por capacidad y objetivo; no se usa como castigo ni como remate obligatorio de las pesas.",
    progresion: [
      "Mantener el rango de repeticiones y el RIR objetivo con técnica reproducible.",
      "Cuando se alcance el extremo superior del rango en dos exposiciones, aumentar la carga aproximadamente 2,5–5%.",
      "No aumentar simultáneamente carga, series y densidad.",
    ],
    criteriosReduccion: [
      "Dolor nuevo o creciente, síntomas de alarma o pérdida de función.",
      "Retroceso de rendimiento en dos exposiciones comparables.",
      "Sueño o energía ≤2, recuperación baja sostenida o adherencia menor a 70%.",
    ],
    revisionCadaSemanas: requiereRevision ? 1 : limitar(entrevista.medicion.revisionCadaSemanas ?? 4, 1, 6),
    supuestos,
  };
}
