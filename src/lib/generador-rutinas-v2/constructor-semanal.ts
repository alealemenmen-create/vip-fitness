import type { CategoriaEjercicio, EquipoEjercicio, NivelEjercicio } from "@/lib/ejercicios/tipos";
import { esBaseEstructural, prioridadEstructural, type PatronMovimiento } from "@/lib/rutinas/patrones";
import type { ResultadoMotorDosisV2 } from "@/lib/generador-rutinas-v2/dosis";
import {
  GRUPOS_DOSIS_V2,
  type EntrevistaVipV2,
  type GrupoDosisV2,
  type NivelExperienciaV2,
  type ObjetivoVipV2,
} from "@/lib/generador-rutinas-v2/tipos";

export const VERSION_CONSTRUCTOR_SEMANAL_VIP_2 = 2 as const;

export type EjercicioConstructorV2 = {
  id: string;
  nombre: string;
  aliases: string[];
  grupoMuscular: "pecho" | "espalda" | "piernas" | "hombros" | "brazos" | "core" | "cardio";
  categoria: CategoriaEjercicio;
  equipo: EquipoEjercicio;
  nivel: NivelEjercicio;
  patron: PatronMovimiento;
  impacto: "bajo" | "medio" | "alto";
  requiereSalto: boolean;
  complejidad: "baja" | "media" | "alta";
  requiereSupervision: boolean;
  posicionSesion: "activacion" | "principal" | "accesorio" | "finalizador" | "cardio";
  etiquetasPrecaucion: string[];
};

export type EjercicioSemanaV2 = {
  orden: number;
  ejercicioId: string;
  nombre: string;
  grupoDosis: GrupoDosisV2;
  patron: PatronMovimiento;
  series: number;
  repeticiones: string;
  rir: string;
  descansoSegundos: number;
  motivo: string;
  sustituciones: Array<{ ejercicioId: string; nombre: string; patron: PatronMovimiento }>;
};

export type DiaSemanaV2 = {
  numero: number;
  nombre: string;
  enfoque: GrupoDosisV2[];
  seriesDirectas: number;
  minutosEstimados: number;
  ejercicios: EjercicioSemanaV2[];
};

export type AuditoriaGrupoSemanaV2 = {
  grupo: GrupoDosisV2;
  objetivo: number;
  programadas: number;
  frecuenciaObjetivo: number;
  frecuenciaProgramada: number;
  cumple: boolean;
};

export type ResultadoConstructorSemanalV2 = {
  version: typeof VERSION_CONSTRUCTOR_SEMANAL_VIP_2;
  estado: "no_disponible" | "provisional_revision" | "borrador";
  razones: string[];
  alertas: string[];
  reglasAplicadas: string[];
  dias: DiaSemanaV2[];
  auditoria: {
    seriesObjetivo: number;
    seriesProgramadas: number;
    minutosMaximosPermitidos: number | null;
    minutosMaximosProgramados: number;
    catalogoRecibido: number;
    catalogoElegible: number;
    porGrupo: AuditoriaGrupoSemanaV2[];
  };
};

type BloqueGrupo = { grupo: GrupoDosisV2; series: number };

export type DiaDivisionVipV2 = {
  nombre: string;
  grupos: readonly GrupoDosisV2[];
  brazo?: "biceps" | "triceps" | "ambos";
};

export type DivisionSemanalVipV2 = {
  familia: "cuerpo_completo" | "superior_inferior" | "culturismo_clasico" | "wellness" | "empuje_traccion_piernas";
  fundamento: string;
  dias: readonly DiaDivisionVipV2[];
};

const ORDEN_GRUPO: Record<GrupoDosisV2, number> = {
  cuadriceps: 0,
  gluteos: 1,
  femorales: 2,
  pecho: 3,
  espalda: 4,
  hombros: 5,
  brazos: 6,
  pantorrillas: 7,
  core: 8,
};

const NOMBRE_GRUPO: Record<GrupoDosisV2, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  brazos: "Brazos",
  cuadriceps: "Cuádriceps",
  femorales: "Femorales",
  gluteos: "Glúteos",
  pantorrillas: "Pantorrillas",
  core: "Core",
};

const RANGO_NIVEL: Record<NivelExperienciaV2, number> = {
  novato: 0,
  intermedio: 1,
  avanzado: 2,
  elite_profesional: 2,
};

const RANGO_EJERCICIO: Record<NivelEjercicio, number> = {
  principiante: 0,
  intermedio: 1,
  avanzado: 2,
};

const EQUIPO_COMPATIBLE: Record<EntrevistaVipV2["recursos"]["equipo"], readonly EquipoEjercicio[]> = {
  sin_responder: [],
  gimnasio_completo: ["barra", "mancuerna", "polea", "maquina", "smith", "peso_corporal", "kettlebell", "banda", "banco", "otro"],
  maquinas: ["maquina", "polea", "smith", "banda", "peso_corporal", "banco"],
  peso_libre: ["barra", "mancuerna", "kettlebell", "peso_corporal", "banco", "banda"],
  casa: ["peso_corporal", "banda", "mancuerna", "kettlebell", "banco", "otro"],
  adaptado: ["maquina", "polea", "banda", "peso_corporal", "banco", "otro"],
};

function normalizar(texto: string): string {
  return texto.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

function fragmentos(texto: string): string[] {
  return texto.split(/[,;\n]/).map(normalizar).filter((item) => item.length >= 3);
}

export function grupoDosisDelEjercicioV2(ejercicio: EjercicioConstructorV2): GrupoDosisV2 | null {
  if (ejercicio.grupoMuscular !== "piernas") {
    if (ejercicio.grupoMuscular === "cardio") return null;
    return ejercicio.grupoMuscular;
  }
  if (ejercicio.patron === "pierna_pantorrilla") return "pantorrillas";
  if (["pierna_empuje_cadera", "pierna_abduccion", "pierna_aduccion"].includes(ejercicio.patron)) return "gluteos";
  if (["pierna_bisagra_cadera", "pierna_flexion_rodilla"].includes(ejercicio.patron)) return "femorales";
  if (["pierna_dominante_rodilla", "pierna_extension_rodilla"].includes(ejercicio.patron)) return "cuadriceps";

  const nombre = normalizar(ejercicio.nombre);
  if (/gemelo|pantorrilla/.test(nombre)) return "pantorrillas";
  if (/glute|abdu|adu|hip thrust|puente/.test(nombre)) return "gluteos";
  if (/femoral|isquio|rumano|peso muerto/.test(nombre)) return "femorales";
  return "cuadriceps";
}

function requiereFiltroConservador(entrevista: EntrevistaVipV2, dosis: ResultadoMotorDosisV2): boolean {
  return dosis.estado === "provisional_revision"
    || dosis.nivelExperiencia === "novato"
    || entrevista.persona.etapaVida === "adulto_mayor"
    || entrevista.persona.contextos.some((contexto) => contexto !== "ninguno");
}

function elegible(
  ejercicio: EjercicioConstructorV2,
  entrevista: EntrevistaVipV2,
  dosis: ResultadoMotorDosisV2,
  noDeseados: string[],
  textoPrecauciones: string,
): boolean {
  if (grupoDosisDelEjercicioV2(ejercicio) === null) return false;
  if (!EQUIPO_COMPATIBLE[entrevista.recursos.equipo].includes(ejercicio.equipo)) return false;
  if (RANGO_EJERCICIO[ejercicio.nivel] > RANGO_NIVEL[dosis.nivelExperiencia]) return false;
  if (noDeseados.some((fragmento) => normalizar(`${ejercicio.nombre} ${ejercicio.aliases.join(" ")}`).includes(fragmento))) return false;
  if (entrevista.recursos.supervision === "sin_supervision" && ejercicio.requiereSupervision) return false;

  const conservador = requiereFiltroConservador(entrevista, dosis);
  if (conservador && (ejercicio.requiereSalto || ejercicio.impacto === "alto" || ejercicio.complejidad === "alta")) return false;
  if (ejercicio.etiquetasPrecaucion.some((etiqueta) => textoPrecauciones.includes(normalizar(etiqueta)))) return false;
  return true;
}

export function obtenerCatalogoElegibleVipV2(
  entrevista: EntrevistaVipV2,
  dosis: ResultadoMotorDosisV2,
  catalogo: EjercicioConstructorV2[],
): EjercicioConstructorV2[] {
  const noDeseados = fragmentos(entrevista.preferencias.ejerciciosNoDeseados);
  const textoPrecauciones = normalizar([
    entrevista.seguridad.detalle,
    entrevista.recursos.accesibilidad,
    entrevista.funcion.ayudasTecnicas,
  ].join(" "));
  return catalogo.filter((ejercicio) => elegible(ejercicio, entrevista, dosis, noDeseados, textoPrecauciones));
}

function repartirSeries(total: number, frecuencia: number, maximoPorSesion: number): number[] {
  if (total <= 0 || frecuencia <= 0) return [];
  const cantidad = Math.min(total, frecuencia);
  const resultado = Array.from({ length: cantidad }, () => 0);
  for (let serie = 0; serie < total; serie += 1) {
    const indice = serie % cantidad;
    if (resultado[indice] < maximoPorSesion) resultado[indice] += 1;
    else {
      const disponible = resultado.findIndex((valor) => valor < maximoPorSesion);
      if (disponible >= 0) resultado[disponible] += 1;
    }
  }
  return resultado.filter(Boolean);
}

const TODOS_LOS_GRUPOS: readonly GrupoDosisV2[] = [
  "cuadriceps", "gluteos", "femorales", "pecho", "espalda", "hombros", "brazos", "pantorrillas", "core",
];
const GRUPOS_SUPERIORES: readonly GrupoDosisV2[] = ["pecho", "espalda", "hombros", "brazos"];
const GRUPOS_INFERIORES: readonly GrupoDosisV2[] = ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"];
const DIVISIONES_INFERIOR_PRIORITARIO = new Set<EntrevistaVipV2["competencia"]["division"]>([
  "wellness", "bikini", "figure", "fitness", "fit_model",
]);

/**
 * La división semanal se decide antes que la dosis y los ejercicios. Esta es
 * una regla de programación: evita crear parejas musculares accidentales solo
 * porque dos bloques caben en el mismo día.
 */
export function seleccionarDivisionSemanalVipV2(
  entrevista: EntrevistaVipV2,
  diasSolicitados: number,
): DivisionSemanalVipV2 {
  const dias = Math.min(7, Math.max(1, diasSolicitados));
  const letras = ["A", "B", "C", "D", "E", "F", "G"];

  if (dias <= 3) {
    return {
      familia: "cuerpo_completo",
      fundamento: "La baja frecuencia semanal se organiza como cuerpo completo para repetir patrones sin abandonar grupos musculares.",
      dias: Array.from({ length: dias }, (_, indice) => ({ nombre: `Cuerpo completo ${letras[indice]}`, grupos: TODOS_LOS_GRUPOS })),
    };
  }

  if (dias === 4) {
    return {
      familia: "superior_inferior",
      fundamento: "Dos exposiciones superiores y dos inferiores alternadas conservan frecuencia y recuperación.",
      dias: [
        { nombre: "Tren superior A", grupos: GRUPOS_SUPERIORES, brazo: "ambos" },
        { nombre: "Tren inferior A · cuádriceps", grupos: GRUPOS_INFERIORES },
        { nombre: "Tren superior B", grupos: GRUPOS_SUPERIORES, brazo: "ambos" },
        { nombre: "Tren inferior B · cadena posterior", grupos: ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"] },
      ],
    };
  }

  const division = entrevista.competencia.division;
  const inferiorPrioritario = entrevista.competencia.compite === "si"
    && division !== null
    && DIVISIONES_INFERIOR_PRIORITARIO.has(division);

  if (dias === 5 && inferiorPrioritario) {
    return {
      familia: "wellness",
      fundamento: "Tres sesiones inferiores y dos superiores replican la estructura observada en los planes Wellness/Bikini, con 48 horas entre estímulos inferiores dominantes.",
      dias: [
        { nombre: "Inferior A · cuádriceps y glúteos", grupos: ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"] },
        { nombre: "Tren superior A · amplitud", grupos: ["espalda", "hombros", "pecho", "brazos"], brazo: "ambos" },
        { nombre: "Inferior B · cadena posterior", grupos: ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"] },
        { nombre: "Tren superior B · densidad", grupos: ["espalda", "hombros", "pecho", "brazos"], brazo: "ambos" },
        { nombre: "Inferior C · global", grupos: ["gluteos", "cuadriceps", "femorales", "pantorrillas", "core"] },
      ],
    };
  }

  if (dias === 5) {
    return {
      familia: "culturismo_clasico",
      fundamento: "La semana separa empuje, tracción y tren inferior; la segunda exposición de cada zona se programa sin mezclar grupos grandes incompatibles.",
      dias: [
        { nombre: "Empuje · pecho, hombros y tríceps", grupos: ["pecho", "hombros", "brazos"], brazo: "triceps" },
        { nombre: "Tracción · espalda y bíceps", grupos: ["espalda", "brazos"], brazo: "biceps" },
        { nombre: "Inferior A · cuádriceps", grupos: ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"] },
        { nombre: "Torso clásico", grupos: ["pecho", "espalda", "hombros", "brazos"], brazo: "ambos" },
        { nombre: "Inferior B · cadena posterior", grupos: ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"] },
      ],
    };
  }

  const diasPpl: DiaDivisionVipV2[] = [
    { nombre: "Empuje A", grupos: ["pecho", "hombros", "brazos"], brazo: "triceps" },
    { nombre: "Tracción A", grupos: ["espalda", "brazos"], brazo: "biceps" },
    { nombre: "Piernas A · cuádriceps", grupos: GRUPOS_INFERIORES },
    { nombre: "Empuje B", grupos: ["pecho", "hombros", "brazos"], brazo: "triceps" },
    { nombre: "Tracción B", grupos: ["espalda", "brazos"], brazo: "biceps" },
    { nombre: "Piernas B · cadena posterior", grupos: ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"] },
  ];
  if (dias === 7) diasPpl.push({ nombre: "Accesorios · brazos, pantorrillas y core", grupos: ["brazos", "pantorrillas", "core"], brazo: "ambos" });
  return {
    familia: "empuje_traccion_piernas",
    fundamento: "Dos ciclos de empuje, tracción y piernas ordenan seis sesiones; el séptimo día, si se solicita, queda limitado a accesorios de baja interferencia.",
    dias: diasPpl,
  };
}

function distribuirBloques(
  dosis: ResultadoMotorDosisV2,
  division: DivisionSemanalVipV2,
): BloqueGrupo[][] {
  const dias = dosis.estructura.diasRecomendados ?? 0;
  const capacidad = dosis.estructura.capacidadSeriesTrabajoPorSesion ?? Number.POSITIVE_INFINITY;
  const bloques = Array.from({ length: dias }, () => [] as BloqueGrupo[]);
  const carga = Array.from({ length: dias }, () => 0);

  for (const grupo of [...dosis.dosisPorGrupo].sort((a, b) => b.seriesDirectasSemanales.objetivo - a.seriesDirectasSemanales.objetivo || ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo])) {
    const partes = repartirSeries(grupo.seriesDirectasSemanales.objetivo, grupo.frecuenciaSemanal, grupo.maximoPorSesion);
    const usados = new Set<number>();
    for (const [indiceParte, series] of partes.entries()) {
      const brazoDeseado = grupo.grupo === "brazos" && partes.length >= 2
        ? (indiceParte % 2 === 0 ? "triceps" : "biceps")
        : null;
      const compatibles = division.dias
        .map((dia, indice) => dia.grupos.includes(grupo.grupo)
          && (!brazoDeseado || dia.brazo === brazoDeseado || dia.brazo === "ambos") ? indice : -1)
        .filter((indice) => indice >= 0 && !usados.has(indice));
      let mejorDia = -1;
      let mejorPuntaje = Number.POSITIVE_INFINITY;
      for (const dia of compatibles) {
        const exceso = Math.max(0, carga[dia] + series - capacidad);
        const cercania = [...usados].reduce((suma, usado) => suma + Math.max(0, 2 - Math.abs(usado - dia)), 0);
        const penalizacionGenerica = brazoDeseado && division.dias[dia].brazo === "ambos" ? 500 : 0;
        const puntaje = exceso * 1000 + penalizacionGenerica + carga[dia] * 10 + cercania;
        if (puntaje < mejorPuntaje) {
          mejorPuntaje = puntaje;
          mejorDia = dia;
        }
      }
      // Todas las plantillas incluyen cupos suficientes para las frecuencias
      // que autoriza el motor de dosis. El respaldo conserva el grupo dentro
      // de un día compatible, incluso ante datos históricos atípicos.
      if (mejorDia < 0) {
        const respaldo = division.dias
          .map((dia, indice) => dia.grupos.includes(grupo.grupo) ? indice : -1)
          .filter((indice) => indice >= 0)
          .sort((a, b) => carga[a] - carga[b])[0];
        mejorDia = respaldo ?? 0;
      }
      bloques[mejorDia].push({ grupo: grupo.grupo, series });
      carga[mejorDia] += series;
      usados.add(mejorDia);
    }
  }
  return bloques;
}

function seriesPorEjercicio(total: number, ejerciciosDisponibles = 3): number[] {
  if (total <= 0) return [];
  const cantidad = Math.min(Math.max(1, ejerciciosDisponibles), 3, Math.max(1, Math.ceil(total / 4)));
  const resultado = Array.from({ length: cantidad }, () => Math.floor(total / cantidad));
  for (let indice = 0; indice < total % cantidad; indice += 1) resultado[indice] += 1;
  return resultado.filter(Boolean);
}

function rangoRepeticiones(objetivo: ObjetivoVipV2, esBase: boolean): string {
  if (objetivo === "fuerza") return esBase ? "4–6" : "6–10";
  if (objetivo === "potencia") return esBase ? "3–6 rápidas" : "6–8";
  if (objetivo === "rendimiento") return esBase ? "5–8" : "8–12";
  if (["hipertrofia", "recomposicion", "competencia"].includes(objetivo)) return esBase ? "6–10" : "10–15";
  if (objetivo === "perdida_grasa") return esBase ? "8–12" : "10–15";
  return esBase ? "8–12" : "10–15";
}

function descansoMedio(rango: readonly [number, number] | null, respaldo: number): number {
  if (!rango) return respaldo;
  return Math.round((rango[0] + rango[1]) / 2 / 15) * 15;
}

function puntuarEjercicio(
  ejercicio: EjercicioConstructorV2,
  preferidos: string[],
  usadosSemana: Set<string>,
  patronesDia: Set<PatronMovimiento>,
  indiceEjercicio: number,
): number {
  const texto = normalizar(`${ejercicio.nombre} ${ejercicio.aliases.join(" ")}`);
  let puntaje = preferidos.some((preferido) => texto.includes(preferido)) ? 100 : 0;
  if (!usadosSemana.has(ejercicio.id)) puntaje += 30;
  if (!patronesDia.has(ejercicio.patron)) puntaje += 24;
  if (indiceEjercicio === 0 && ejercicio.posicionSesion === "principal") puntaje += 20;
  if (indiceEjercicio === 0 && esBaseEstructural(ejercicio.patron)) puntaje += 16;
  if (["maquina", "polea", "smith"].includes(ejercicio.equipo)) puntaje += 3;
  puntaje -= prioridadEstructural(ejercicio.patron) * 2;
  return puntaje;
}

function motivoSeleccion(ejercicio: EjercicioConstructorV2, repetido: boolean): string {
  const base = esBaseEstructural(ejercicio.patron) ? "patrón estructural" : "complemento de patrón";
  return repetido
    ? `${base}; se repite porque es la mejor opción compatible disponible.`
    : `${base}, compatible con el nivel, equipo y supervisión declarados.`;
}

function minutosSesion(ejercicios: EjercicioSemanaV2[]): number {
  if (ejercicios.length === 0) return 0;
  const segundosTrabajo = ejercicios.reduce((total, ejercicio) => total + ejercicio.series * (45 + ejercicio.descansoSegundos), 0);
  return Math.ceil(10 + segundosTrabajo / 60 + Math.max(0, ejercicios.length - 1));
}

function auditoriaVacia(catalogoRecibido: number): ResultadoConstructorSemanalV2["auditoria"] {
  return {
    seriesObjetivo: 0,
    seriesProgramadas: 0,
    minutosMaximosPermitidos: null,
    minutosMaximosProgramados: 0,
    catalogoRecibido,
    catalogoElegible: 0,
    porGrupo: [],
  };
}

export function construirSemanaVipV2(
  entrevista: EntrevistaVipV2,
  dosis: ResultadoMotorDosisV2,
  catalogo: EjercicioConstructorV2[],
): ResultadoConstructorSemanalV2 {
  if (dosis.estado === "no_disponible") {
    return {
      version: VERSION_CONSTRUCTOR_SEMANAL_VIP_2,
      estado: "no_disponible",
      razones: dosis.razones,
      alertas: [],
      reglasAplicadas: [],
      dias: [],
      auditoria: auditoriaVacia(catalogo.length),
    };
  }

  const preferidos = fragmentos(entrevista.preferencias.ejerciciosPreferidos);
  const elegibles = obtenerCatalogoElegibleVipV2(entrevista, dosis, catalogo);
  const porGrupo = new Map<GrupoDosisV2, EjercicioConstructorV2[]>();
  for (const grupo of GRUPOS_DOSIS_V2) porGrupo.set(grupo, []);
  for (const ejercicio of elegibles) {
    const grupo = grupoDosisDelEjercicioV2(ejercicio);
    if (grupo) porGrupo.get(grupo)?.push(ejercicio);
  }
  for (const lista of porGrupo.values()) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const division = seleccionarDivisionSemanalVipV2(entrevista, dosis.estructura.diasRecomendados ?? 0);
  const bloquesPorDia = distribuirBloques(dosis, division);
  const usadosSemana = new Set<string>();
  const alertas: string[] = [];
  const objetivo = entrevista.objetivo.principal ?? "salud";
  const descansoCompuesto = descansoMedio(dosis.intensidad.descansoCompuestosSegundos, 120);
  const descansoAislamiento = descansoMedio(dosis.intensidad.descansoAislamientosSegundos, 75);

  const dias: DiaSemanaV2[] = bloquesPorDia.map((bloques, indiceDia) => {
    const patronesDia = new Set<PatronMovimiento>();
    const ejercicios: EjercicioSemanaV2[] = [];
    const ordenDivision = new Map(division.dias[indiceDia].grupos.map((grupo, indice) => [grupo, indice]));
    const bloquesOrdenados = [...bloques].sort((a, b) => (ordenDivision.get(a.grupo) ?? 99) - (ordenDivision.get(b.grupo) ?? 99));

    for (const bloque of bloquesOrdenados) {
      const candidatosBase = porGrupo.get(bloque.grupo) ?? [];
      const enfoqueBrazo = division.dias[indiceDia].brazo;
      const candidatosFiltrados = bloque.grupo === "brazos" && enfoqueBrazo && enfoqueBrazo !== "ambos"
        ? candidatosBase.filter((ejercicio) => normalizar(ejercicio.patron).startsWith(enfoqueBrazo))
        : candidatosBase;
      const candidatos = candidatosFiltrados.length > 0 ? candidatosFiltrados : candidatosBase;
      if (candidatos.length === 0) {
        alertas.push(`${NOMBRE_GRUPO[bloque.grupo]}: no hay un ejercicio elegible para el equipo, nivel y restricciones declaradas.`);
        continue;
      }
      // Si el catálogo solo ofrece una variante compatible (algo frecuente en
      // pantorrillas o equipamiento adaptado), concentra la dosis en esa
      // variante. Crear dos filas idénticas en la misma sesión no aporta otro
      // estímulo y la Mesa de Edición lo detecta correctamente como duplicado.
      const partes = seriesPorEjercicio(bloque.series, candidatos.length);
      for (let indiceParte = 0; indiceParte < partes.length; indiceParte += 1) {
        const ordenados = [...candidatos].sort((a, b) => {
          const puntajeB = puntuarEjercicio(b, preferidos, usadosSemana, patronesDia, indiceParte);
          const puntajeA = puntuarEjercicio(a, preferidos, usadosSemana, patronesDia, indiceParte);
          return puntajeB - puntajeA || a.nombre.localeCompare(b.nombre, "es");
        });
        const elegido = ordenados.find((item) => !ejercicios.some((ejercicio) => ejercicio.ejercicioId === item.id)) ?? ordenados[0];
        const eraRepetido = usadosSemana.has(elegido.id);
        const base = esBaseEstructural(elegido.patron);
        const sustituciones = ordenados
          .filter((item) => item.id !== elegido.id)
          .sort((a, b) => Number(b.patron === elegido.patron) - Number(a.patron === elegido.patron) || a.nombre.localeCompare(b.nombre, "es"))
          .slice(0, 2)
          .map((item) => ({ ejercicioId: item.id, nombre: item.nombre, patron: item.patron }));
        ejercicios.push({
          orden: 0,
          ejercicioId: elegido.id,
          nombre: elegido.nombre,
          grupoDosis: bloque.grupo,
          patron: elegido.patron,
          series: partes[indiceParte],
          repeticiones: rangoRepeticiones(objetivo, base),
          rir: (base ? dosis.intensidad.rirCompuestos : dosis.intensidad.rirAislamientos)?.join("–") ?? "—",
          descansoSegundos: base ? descansoCompuesto : descansoAislamiento,
          motivo: motivoSeleccion(elegido, eraRepetido),
          sustituciones,
        });
        usadosSemana.add(elegido.id);
        patronesDia.add(elegido.patron);
      }
    }

    ejercicios.sort((a, b) => {
      const prioridadA = dosis.dosisPorGrupo.find((item) => item.grupo === a.grupoDosis)?.prioridad === "prioridad" ? -100 : 0;
      const prioridadB = dosis.dosisPorGrupo.find((item) => item.grupo === b.grupoDosis)?.prioridad === "prioridad" ? -100 : 0;
      return (ordenDivision.get(a.grupoDosis) ?? 99) - (ordenDivision.get(b.grupoDosis) ?? 99)
        || prioridadA - prioridadB
        || prioridadEstructural(a.patron) - prioridadEstructural(b.patron);
    });
    ejercicios.forEach((ejercicio, indice) => { ejercicio.orden = indice + 1; });
    const enfoque = [...new Set(bloquesOrdenados.map((bloque) => bloque.grupo))];
    return {
      numero: indiceDia + 1,
      nombre: division.dias[indiceDia]?.nombre ?? `Sesión ${indiceDia + 1}`,
      enfoque,
      seriesDirectas: ejercicios.reduce((total, ejercicio) => total + ejercicio.series, 0),
      minutosEstimados: minutosSesion(ejercicios),
      ejercicios,
    };
  });

  const auditoriaGrupos: AuditoriaGrupoSemanaV2[] = dosis.dosisPorGrupo.map((grupo) => {
    const programadas = dias.reduce((total, dia) => total + dia.ejercicios.filter((ejercicio) => ejercicio.grupoDosis === grupo.grupo).reduce((suma, ejercicio) => suma + ejercicio.series, 0), 0);
    const frecuenciaProgramada = dias.filter((dia) => dia.ejercicios.some((ejercicio) => ejercicio.grupoDosis === grupo.grupo)).length;
    const cumple = programadas === grupo.seriesDirectasSemanales.objetivo && frecuenciaProgramada === grupo.frecuenciaSemanal;
    if (!cumple) alertas.push(`${NOMBRE_GRUPO[grupo.grupo]}: objetivo ${grupo.seriesDirectasSemanales.objetivo} series/${grupo.frecuenciaSemanal} sesiones; borrador ${programadas}/${frecuenciaProgramada}.`);
    return {
      grupo: grupo.grupo,
      objetivo: grupo.seriesDirectasSemanales.objetivo,
      programadas,
      frecuenciaObjetivo: grupo.frecuenciaSemanal,
      frecuenciaProgramada,
      cumple,
    };
  });
  const minutosPermitidos = dosis.estructura.minutosPorSesion;
  const maximoProgramado = Math.max(0, ...dias.map((dia) => dia.minutosEstimados));
  if (minutosPermitidos !== null && maximoProgramado > minutosPermitidos) {
    alertas.push(`La sesión más larga estima ${maximoProgramado} minutos y supera el límite de ${minutosPermitidos}; requiere recorte manual.`);
  }
  if (elegibles.length === 0) alertas.push("El catálogo quedó vacío después de aplicar equipo, nivel, supervisión y restricciones.");

  return {
    version: VERSION_CONSTRUCTOR_SEMANAL_VIP_2,
    estado: dosis.estado === "provisional_revision" ? "provisional_revision" : "borrador",
    razones: dosis.estado === "provisional_revision"
      ? ["La estructura es solo una propuesta hasta que el entrenador resuelva las adaptaciones pendientes."]
      : ["La semana respeta la dosis calculada y queda pendiente de revisión del entrenador."],
    alertas: [...new Set(alertas)],
    reglasAplicadas: [
      `La división ${division.familia.replaceAll("_", " ")} se decide antes de distribuir la dosis: ${division.fundamento}`,
      "La dosis directa se distribuye dentro de días muscularmente compatibles antes de elegir ejercicios.",
      "El orden de cada sesión respeta el enfoque del día y coloca patrones estructurales antes que aislamientos.",
      "Cada ejercicio pasa filtros de equipo, nivel, supervisión, impacto y preferencias declaradas.",
      "Los patrones estructurales y la variedad biomecánica se priorizan sin obligar a repetir ejercicios.",
      "Los reemplazos conservan el grupo objetivo y priorizan el mismo patrón de movimiento.",
      "Las técnicas avanzadas no se insertan automáticamente en esta etapa.",
    ],
    dias,
    auditoria: {
      seriesObjetivo: auditoriaGrupos.reduce((total, grupo) => total + grupo.objetivo, 0),
      seriesProgramadas: auditoriaGrupos.reduce((total, grupo) => total + grupo.programadas, 0),
      minutosMaximosPermitidos: minutosPermitidos,
      minutosMaximosProgramados: maximoProgramado,
      catalogoRecibido: catalogo.length,
      catalogoElegible: elegibles.length,
      porGrupo: auditoriaGrupos,
    },
  };
}
