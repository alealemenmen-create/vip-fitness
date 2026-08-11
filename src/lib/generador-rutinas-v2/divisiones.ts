import type {
  DivisionCompetitivaV2,
  EntrevistaVipV2,
  GrupoDosisV2,
  NivelExperienciaV2,
} from "@/lib/generador-rutinas-v2/tipos";

export type FamiliaDivisionVipV2 =
  | "cuerpo_completo"
  | "superior_inferior"
  | "culturismo_clasico"
  | "antagonistas"
  | "especializacion"
  | "regional"
  | "empuje_traccion_piernas"
  | "fitness_hibrido";

export type DiaDivisionVipV2 = {
  nombre: string;
  grupos: readonly GrupoDosisV2[];
  brazo?: "biceps" | "triceps" | "ambos";
  permiteMezclaSuperiorInferior?: boolean;
};

export type OpcionDivisionVipV2 = {
  id: string;
  nombre: string;
  categoria: DivisionCompetitivaV2 | "general";
  familia: FamiliaDivisionVipV2;
  descripcion: string;
  fundamento: string;
  diasEntrenamiento: number;
  descansosSugeridos: string;
  nivelMinimo: NivelExperienciaV2;
  dias: readonly DiaDivisionVipV2[];
};

const SUPERIOR: readonly GrupoDosisV2[] = ["pecho", "espalda", "hombros", "brazos"];
const INFERIOR: readonly GrupoDosisV2[] = ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"];
const TODOS: readonly GrupoDosisV2[] = [...SUPERIOR, ...INFERIOR];

function superior(nombre: string, grupos: readonly GrupoDosisV2[] = SUPERIOR, brazo: DiaDivisionVipV2["brazo"] = "ambos"): DiaDivisionVipV2 {
  return { nombre, grupos, brazo };
}

function inferior(nombre: string, orden: readonly GrupoDosisV2[] = INFERIOR): DiaDivisionVipV2 {
  const normalizado = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const regionesDeclaradas: GrupoDosisV2[] = [];
  if (normalizado.includes("cuadriceps") || normalizado.includes("anterior")) regionesDeclaradas.push("cuadriceps");
  if (normalizado.includes("femoral") || normalizado.includes("posterior") || normalizado.includes("cadena")) regionesDeclaradas.push("femorales");
  if (normalizado.includes("glute")) regionesDeclaradas.push("gluteos");
  if (normalizado.includes("pantorrilla")) regionesDeclaradas.push("pantorrillas");

  if (regionesDeclaradas.length === 0) return { nombre, grupos: orden };

  const accesorios = orden.filter((grupo) => grupo === "pantorrillas" || grupo === "core");
  return { nombre, grupos: Array.from(new Set([...regionesDeclaradas, ...accesorios])) };
}

function opcion(
  id: string,
  nombre: string,
  categoria: OpcionDivisionVipV2["categoria"],
  familia: FamiliaDivisionVipV2,
  descripcion: string,
  dias: readonly DiaDivisionVipV2[],
  descansosSugeridos = "Insertar al menos un descanso después de 2–3 sesiones consecutivas.",
  nivelMinimo: NivelExperienciaV2 = "intermedio",
): OpcionDivisionVipV2 {
  return {
    id,
    nombre,
    categoria,
    familia,
    descripcion,
    fundamento: "La división se selecciona antes de repartir series y no admite combinaciones musculares fuera de sus días declarados.",
    diasEntrenamiento: dias.length,
    descansosSugeridos,
    nivelMinimo,
    dias,
  };
}

const GENERALES_5: readonly OpcionDivisionVipV2[] = [
  opcion("general_clasica_5", "Clásica por grupos", "general", "culturismo_clasico", "Cinco sesiones con identidad muscular clara y piernas divididas.", [
    superior("Pecho + tríceps", ["pecho", "brazos"], "triceps"),
    superior("Espalda + bíceps", ["espalda", "brazos"], "biceps"),
    inferior("Cuádriceps + aductores", ["cuadriceps", "gluteos", "pantorrillas", "core"]),
    superior("Hombros + brazos", ["hombros", "brazos"], "ambos"),
    inferior("Femoral + glúteos + abductores", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
  ]),
  opcion("general_torso_pierna_5", "Torso y pierna especializado", "general", "regional", "Dos sesiones inferiores y tres superiores con una segunda exposición de torso.", [
    superior("Empuje · pecho dominante", ["pecho", "hombros", "brazos"], "triceps"),
    superior("Tracción · espalda dominante", ["espalda", "brazos"], "biceps"),
    inferior("Piernas A · cuádriceps"),
    superior("Torso completo", SUPERIOR, "ambos"),
    inferior("Piernas B · cadena posterior", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]),
  ]),
  opcion("general_antagonistas_5", "Antagonistas culturista", "general", "antagonistas", "Agrupa antagonistas sin cruzar tren superior e inferior.", [
    superior("Pecho + espalda", ["pecho", "espalda"]),
    inferior("Piernas A · cuádriceps"),
    superior("Hombros + brazos", ["hombros", "brazos"], "ambos"),
    inferior("Piernas B · femoral y glúteos", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    superior("Torso · segunda exposición", SUPERIOR, "ambos"),
  ]),
];

const CATEGORIA_5: Partial<Record<DivisionCompetitivaV2, readonly OpcionDivisionVipV2[]>> = {
  mens_open: [
    opcion("open_clasica_5", "Open clásica dividida", "mens_open", "culturismo_clasico", "Gran estímulo local con cadena anterior y posterior separadas.", [
      superior("Pecho + tríceps", ["pecho", "brazos"], "triceps"), superior("Espalda completa + bíceps", ["espalda", "brazos"], "biceps"), inferior("Cuádriceps + pantorrillas"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), inferior("Femoral + glúteos + pantorrillas", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("open_frecuencia_2_5", "Open frecuencia 2", "mens_open", "regional", "Duplica torso y divide las piernas sin repetir sesiones idénticas.", [
      superior("Pecho + espalda · amplitud", ["pecho", "espalda"]), inferior("Cuádriceps + pantorrillas"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), superior("Espalda · densidad + pecho secundario", ["espalda", "pecho", "hombros"]), inferior("Femoral + glúteos + pantorrillas", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("open_espalda_5", "Open · espalda prioritaria", "mens_open", "especializacion", "Dos estímulos dorsales separados por patrón con el resto del físico mantenido.", [
      superior("Espalda · amplitud + bíceps", ["espalda", "brazos"], "biceps"), inferior("Cuádriceps + pantorrillas"), superior("Pecho + tríceps", ["pecho", "brazos"], "triceps"), superior("Espalda · densidad + deltoide posterior", ["espalda", "hombros"]), inferior("Femoral + glúteos + accesorios", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  mens_212: [
    opcion("212_clasica_5", "212 clásica", "mens_212", "culturismo_clasico", "Desarrollo global controlando dónde se añade volumen.", [
      superior("Pecho + bíceps", ["pecho", "brazos"], "biceps"), superior("Espalda completa", ["espalda"]), inferior("Cuádriceps + pantorrillas"), superior("Hombros + tríceps", ["hombros", "brazos"], "triceps"), inferior("Femoral + glúteos + abdomen", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("212_v_taper_5", "212 V-Taper", "mens_212", "especializacion", "Prioriza amplitud, deltoides y cintura visual.", [
      superior("Espalda · amplitud + deltoide lateral", ["espalda", "hombros"]), inferior("Cuádriceps"), superior("Pecho + brazos", ["pecho", "brazos"], "ambos"), superior("Espalda · densidad + deltoide posterior", ["espalda", "hombros"]), inferior("Femoral + glúteos + pantorrillas", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("212_antagonistas_5", "212 antagonistas", "mens_212", "antagonistas", "Dos exposiciones de torso y dos inferiores con volumen distribuido.", [
      superior("Pecho + espalda", ["pecho", "espalda"]), inferior("Cuádriceps + femoral ligero"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), superior("Espalda + pecho", ["espalda", "pecho"]), inferior("Femoral + glúteos + cuádriceps complementario", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  classic_physique: [
    opcion("classic_v_taper_5", "Classic V-Taper", "classic_physique", "regional", "Amplitud y densidad separadas, con piernas anterior/posterior.", [
      superior("Espalda · amplitud + bíceps", ["espalda", "brazos"], "biceps"), inferior("Cuádriceps + pantorrillas"), superior("Pecho + deltoide lateral + tríceps", ["pecho", "hombros", "brazos"], "triceps"), superior("Espalda · densidad + deltoide posterior", ["espalda", "hombros"]), inferior("Femoral + glúteos + pantorrillas", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("classic_5_dias", "Classic sostenible", "classic_physique", "culturismo_clasico", "Modelo de cinco días sostenible con segunda exposición dorsal.", [
      superior("Pecho + bíceps", ["pecho", "brazos"], "biceps"), superior("Espalda · amplitud + deltoide posterior", ["espalda", "hombros"]), inferior("Piernas completas", INFERIOR), superior("Hombros + tríceps", ["hombros", "brazos"], "triceps"), superior("Espalda · densidad + pecho accesorio", ["espalda", "pecho"]),
    ]),
    opcion("classic_torso_frecuente_5", "Classic torso frecuente", "classic_physique", "especializacion", "Alta frecuencia estética superior con piernas divididas.", [
      superior("Espalda + hombro lateral", ["espalda", "hombros"]), inferior("Piernas A · cuádriceps"), superior("Pecho + brazos", ["pecho", "brazos"], "ambos"), superior("Espalda + hombros", ["espalda", "hombros"]), inferior("Piernas B · cadena posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  mens_physique: [
    opcion("mp_v_taper_5", "Men’s Physique V-Taper", "mens_physique", "especializacion", "Doble espalda y doble hombro con una sesión inferior.", [
      superior("Espalda · amplitud + bíceps", ["espalda", "brazos"], "biceps"), superior("Pecho + hombro lateral + tríceps", ["pecho", "hombros", "brazos"], "triceps"), inferior("Piernas + abdomen", INFERIOR), superior("Espalda · densidad + deltoide posterior", ["espalda", "hombros"]), superior("Hombros + brazos + pecho accesorio", SUPERIOR, "ambos"),
    ]),
    opcion("mp_hombro_espalda_5", "Hombro y espalda prioritarios", "mens_physique", "regional", "Arquitectura centrada en la relación hombro-cintura.", [
      superior("Hombros + tríceps", ["hombros", "brazos"], "triceps"), superior("Espalda · amplitud + bíceps", ["espalda", "brazos"], "biceps"), inferior("Piernas + abdomen", INFERIOR), superior("Pecho + hombro lateral", ["pecho", "hombros"]), superior("Espalda · densidad + brazos", ["espalda", "brazos"], "ambos"),
    ]),
    opcion("mp_upper_5", "Upper specialization", "mens_physique", "especializacion", "Cuatro estímulos superiores diferenciados y una sesión inferior.", [
      superior("Upper A · amplitud", SUPERIOR), inferior("Lower completo", INFERIOR), superior("Upper B · pecho y hombro", SUPERIOR), superior("Upper C · densidad", SUPERIOR), superior("Upper D · deltoides y brazos", SUPERIOR, "ambos"),
    ]),
  ],
  mens_wheelchair: [
    opcion("wheelchair_push_pull_5", "Wheelchair Push/Pull", "mens_wheelchair", "regional", "Arquitectura superior sujeta a función de tronco, estabilidad y evaluación profesional.", [
      superior("Push A", ["pecho", "hombros", "brazos", "core"], "triceps"), superior("Pull · amplitud", ["espalda", "brazos", "core"], "biceps"), superior("Hombros + core", ["hombros", "core"]), superior("Push B", ["pecho", "hombros", "brazos", "core"], "triceps"), superior("Pull · densidad + brazos", ["espalda", "brazos", "core"], "biceps"),
    ]),
    opcion("wheelchair_torso_5", "Wheelchair torso A/B", "mens_wheelchair", "antagonistas", "Alterna torso pesado, regional y volumen.", [
      superior("Torso pesado", ["pecho", "espalda", "core"]), superior("Dorsales + bíceps", ["espalda", "brazos", "core"], "biceps"), superior("Pecho + tríceps", ["pecho", "brazos", "core"], "triceps"), superior("Torso volumen", ["pecho", "espalda", "core"]), superior("Deltoide lateral/posterior + brazos", ["hombros", "brazos", "core"], "ambos"),
    ]),
    opcion("wheelchair_regional_5", "Wheelchair regional", "mens_wheelchair", "especializacion", "Separa amplitud, pecho, densidad y deltoides.", [
      superior("Espalda · amplitud", ["espalda", "core"]), superior("Pecho + tríceps", ["pecho", "brazos", "core"], "triceps"), superior("Brazos", ["brazos", "core"], "ambos"), superior("Espalda · densidad", ["espalda", "core"]), superior("Hombros + pecho secundario", ["hombros", "pecho", "core"]),
    ]),
  ],
  womens_bodybuilding: [
    opcion("wbb_clasica_5", "Women’s Bodybuilding clásica", "womens_bodybuilding", "culturismo_clasico", "Desarrollo global con piernas divididas.", [
      superior("Espalda + bíceps", ["espalda", "brazos"], "biceps"), inferior("Cuádriceps"), superior("Pecho + tríceps", ["pecho", "brazos"], "triceps"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), inferior("Femoral + glúteos + accesorios", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("wbb_frecuencia_2_5", "Women’s Bodybuilding frecuencia 2", "womens_bodybuilding", "regional", "Duplica torso y conserva dos sesiones inferiores.", [
      superior("Espalda · amplitud + pecho", ["espalda", "pecho"]), inferior("Cuádriceps"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), superior("Espalda · densidad + pecho", ["espalda", "pecho"]), inferior("Femoral + glúteos + piernas accesorias", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("wbb_especializacion_5", "Women’s Bodybuilding especialización", "womens_bodybuilding", "especializacion", "Permite priorizar un punto débil sin perder desarrollo global.", [
      superior("Punto débil superior", SUPERIOR), inferior("Cuádriceps"), superior("Espalda completa", ["espalda", "hombros"]), superior("Pecho + brazos", ["pecho", "brazos"], "ambos"), inferior("Femoral + glúteos + punto débil", INFERIOR),
    ]),
  ],
  womens_physique: [
    opcion("wp_dorsal_hombro_5", "Women’s Physique dorsal/hombro", "womens_physique", "especializacion", "Dorsal y deltoides prominentes con piernas separadas.", [
      superior("Espalda · amplitud + bíceps", ["espalda", "brazos"], "biceps"), inferior("Cuádriceps"), superior("Hombros + tríceps + pecho", ["hombros", "brazos", "pecho"], "triceps"), superior("Espalda · densidad + pecho", ["espalda", "pecho"]), inferior("Femoral + glúteos", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("wp_torso_lower_5", "Women’s Physique torso/lower", "womens_physique", "superior_inferior", "Tres estímulos de torso y dos inferiores.", [
      superior("Torso A · dorsales", SUPERIOR), inferior("Lower A · cuádriceps"), superior("Torso B · hombros y pecho", SUPERIOR), superior("Torso C · espalda y brazos", SUPERIOR), inferior("Lower B · cadena posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("wp_push_pull_5", "Women’s Physique Push/Pull regional", "womens_physique", "regional", "Diferencia amplitud/densidad y anterior/posterior.", [
      superior("Pull · amplitud", ["espalda", "brazos"], "biceps"), superior("Push", ["pecho", "hombros", "brazos"], "triceps"), inferior("Legs · anterior"), superior("Pull · densidad + hombro posterior", ["espalda", "hombros", "brazos"], "biceps"), inferior("Legs · posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  figure: [
    opcion("figure_v_taper_5", "Figure V-Taper", "figure", "especializacion", "Dos espaldas, dos inferiores y deltoides especializados.", [
      superior("Espalda · amplitud + hombro lateral", ["espalda", "hombros"]), inferior("Glúteo + femoral", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]), superior("Hombros + brazos + pecho mantenimiento", SUPERIOR, "ambos"), superior("Espalda · densidad + deltoide posterior", ["espalda", "hombros"]), inferior("Cuádriceps + glúteos", ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"]),
    ]),
    opcion("figure_espalda_hombro_5", "Figure espalda/hombro 3×", "figure", "especializacion", "Tres contactos de amplitud visual con fatiga distribuida.", [
      superior("Dorsales + deltoide lateral", ["espalda", "hombros"]), inferior("Piernas A", INFERIOR), superior("Hombros + brazos + pecho", SUPERIOR, "ambos"), superior("Espalda · densidad", ["espalda", "hombros"]), inferior("Piernas B + dorsal accesorio", INFERIOR),
    ]),
    opcion("figure_regional_5", "Figure regional", "figure", "regional", "Alterna tirones, tren inferior y deltoides.", [
      superior("Pull · amplitud", ["espalda", "brazos"], "biceps"), inferior("Lower · anterior"), superior("Push · hombro dominante", ["hombros", "pecho", "brazos"], "triceps"), superior("Pull · densidad", ["espalda", "hombros", "brazos"], "biceps"), inferior("Lower · posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  bikini: [
    opcion("bikini_clasica_5", "Bikini clásica moderna", "bikini", "regional", "Tres estímulos inferiores y dos superiores proporcionados.", [
      inferior("Glúteos + femorales", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]), superior("Espalda + hombro lateral", SUPERIOR), inferior("Glúteos + cuádriceps moderado", ["gluteos", "cuadriceps", "femorales", "pantorrillas", "core"]), superior("Hombros + espalda + brazos", SUPERIOR, "ambos"), inferior("Glúteos accesorios", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("bikini_gluteo_3x_5", "Bikini glúteos 3×", "bikini", "especializacion", "Alta tensión, sesión técnica y volumen moderado; no tres sesiones máximas.", [
      inferior("Glúteo pesado + femoral", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]), superior("Hombros + dorsales", SUPERIOR), inferior("Glúteo técnico + cuádriceps", ["gluteos", "cuadriceps", "femorales", "pantorrillas", "core"]), superior("Tren superior equilibrado", SUPERIOR), inferior("Glúteo volumen", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]),
    ]),
    opcion("bikini_upper_lower_5", "Bikini Upper/Lower estético", "bikini", "superior_inferior", "Tres lower diferenciados y dos upper de amplitud visual.", [
      inferior("Lower A · glúteo/femoral", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]), superior("Upper A · dorsales/hombros", SUPERIOR), inferior("Lower B · glúteo/cuádriceps", ["gluteos", "cuadriceps", "femorales", "pantorrillas", "core"]), superior("Upper B · hombros/espalda", SUPERIOR), inferior("Lower C · glúteo especializado", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  wellness: [
    opcion("wellness_clasica_5", "Wellness clásica", "wellness", "regional", "Tres lower seriamente programados y dos upper proporcionados.", [
      inferior("Glúteos + cuádriceps", ["gluteos", "cuadriceps", "femorales", "pantorrillas", "core"]), superior("Espalda + hombros", SUPERIOR), inferior("Femoral + glúteos", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]), superior("Tren superior completo", SUPERIOR), inferior("Cuádriceps + glúteos", ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"]),
    ]),
    opcion("wellness_3_lower_2_upper", "Wellness 3 lower / 2 upper", "wellness", "superior_inferior", "La arquitectura más directa para priorizar tren inferior sin abandonar proporción.", [
      inferior("Lower A · cuádriceps/glúteo"), superior("Upper A", SUPERIOR), inferior("Lower B · femoral/glúteo", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]), superior("Upper B", SUPERIOR), inferior("Lower C · cuádriceps/glúteo", ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"]),
    ]),
    opcion("wellness_gluteo_5", "Wellness glúteo prioritario", "wellness", "especializacion", "Tres contactos de glúteo con dominancias distintas.", [
      inferior("Glúteo + femoral", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]), superior("Upper A", SUPERIOR), inferior("Cuádriceps + glúteo", ["cuadriceps", "gluteos", "femorales", "pantorrillas", "core"]), superior("Upper B", SUPERIOR), inferior("Glúteo + femoral · volumen controlado", ["gluteos", "femorales", "cuadriceps", "pantorrillas", "core"]),
    ]),
  ],
  fitness: [
    opcion("fitness_fuerza_skill_5", "Fitness fuerza + skills", "fitness", "fitness_hibrido", "Tres sesiones de fuerza y dos exposiciones técnicas contabilizadas como carga.", [
      { ...inferior("Lower + potencia"), permiteMezclaSuperiorInferior: true }, superior("Upper + skill Fitness", SUPERIOR), { nombre: "Movilidad, acrobacia + core", grupos: ["core"], permiteMezclaSuperiorInferior: true }, inferior("Posterior + glúteos", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]), { nombre: "Full body + rutina Fitness", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true },
    ]),
    opcion("fitness_full_body_5", "Fitness full body técnico", "fitness", "fitness_hibrido", "Intercala fuerza global, tren inferior y práctica específica.", [
      superior("Fuerza upper", SUPERIOR), inferior("Piernas + potencia", INFERIOR), { nombre: "Skill + core funcional", grupos: ["core", "hombros"], permiteMezclaSuperiorInferior: true }, { nombre: "Full body hipertrofia", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true }, { nombre: "Rutina Fitness + movilidad", grupos: ["core", "hombros"], permiteMezclaSuperiorInferior: true },
    ]),
    opcion("fitness_push_pull_5", "Fitness Push/Pull + rutina", "fitness", "fitness_hibrido", "Organiza patrones de fuerza sin considerar gratuitos los días técnicos.", [
      superior("Push + skills", ["pecho", "hombros", "brazos", "core"], "triceps"), superior("Pull + core funcional", ["espalda", "brazos", "core"], "biceps"), inferior("Piernas + potencia", INFERIOR), { nombre: "Full body", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true }, { nombre: "Rutina Fitness", grupos: ["core", "hombros"], permiteMezclaSuperiorInferior: true },
    ]),
  ],
  fit_model: [
    opcion("fit_model_4_mas_1", "Fit Model 4 + técnica", "fit_model", "superior_inferior", "Cuatro sesiones principales y una exposición opcional de baja fatiga.", [
      inferior("Lower A · glúteo", INFERIOR), superior("Upper A", SUPERIOR), inferior("Lower B · equilibrado", INFERIOR), superior("Upper B", SUPERIOR), { nombre: "Técnica postural + core", grupos: ["core"], permiteMezclaSuperiorInferior: true },
    ]),
    opcion("fit_model_full_body_5", "Fit Model full body distribuido", "fit_model", "cuerpo_completo", "Dos sesiones globales, dos regionales y una recuperación activa.", [
      { nombre: "Full body A", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true }, inferior("Glúteos + lower", INFERIOR), superior("Espalda + hombros", SUPERIOR), { nombre: "Full body B · ligero", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true }, { nombre: "Técnica + core", grupos: ["core"], permiteMezclaSuperiorInferior: true },
    ]),
    opcion("fit_model_estetica_5", "Fit Model estética equilibrada", "fit_model", "regional", "Prioriza glúteos, espalda y hombros sin maximizar masa indiscriminadamente.", [
      inferior("Glúteo/femoral", INFERIOR), superior("Espalda/hombros", SUPERIOR), inferior("Cuádriceps/glúteo", INFERIOR), superior("Upper equilibrado", SUPERIOR), { nombre: "Full body técnico", grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true },
    ]),
  ],
};

function opcionesBase(dias: number): OpcionDivisionVipV2[] {
  const letras = ["A", "B", "C"];
  if (dias <= 3) {
    return [
      opcion(`general_full_body_${dias}`, `Full body ${dias} días`, "general", "cuerpo_completo", "Todos los patrones principales se distribuyen en cada microciclo.", Array.from({ length: dias }, (_, indice) => ({ nombre: `Cuerpo completo ${letras[indice]}`, grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true })), "Separar las sesiones por al menos un día cuando sea posible.", "novato"),
      opcion(`general_full_body_alternado_${dias}`, `Full body alternado ${dias} días`, "general", "cuerpo_completo", "Mantiene cuerpo completo con énfasis A/B/C diferentes.", Array.from({ length: dias }, (_, indice) => ({ nombre: `Cuerpo completo ${letras[indice]} · énfasis ${indice % 2 === 0 ? "anterior" : "posterior"}`, grupos: TODOS, brazo: "ambos", permiteMezclaSuperiorInferior: true })), "Separar las sesiones por al menos un día cuando sea posible.", "novato"),
    ];
  }
  if (dias === 4) {
    return [
      opcion("general_upper_lower_4", "Upper/Lower A-B", "general", "superior_inferior", "Dos superiores y dos inferiores alternados.", [superior("Upper A"), inferior("Lower A · anterior"), superior("Upper B"), inferior("Lower B · posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"])], "Descanso recomendado entre Lower A y Upper B."),
      opcion("general_push_pull_lower_4", "Push/Pull + Lower A-B", "general", "regional", "Dos superiores por patrón y dos piernas por región.", [superior("Push", ["pecho", "hombros", "brazos"], "triceps"), inferior("Lower A · cuádriceps"), superior("Pull", ["espalda", "brazos", "hombros"], "biceps"), inferior("Lower B · cadena posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"])]),
    ];
  }
  if (dias === 5) return [...GENERALES_5];
  const ppl = [
    superior("Push A · pecho", ["pecho", "hombros", "brazos"], "triceps"),
    superior("Pull A · amplitud", ["espalda", "brazos"], "biceps"),
    inferior("Legs A · cuádriceps"),
    superior("Push B · hombros", ["hombros", "pecho", "brazos"], "triceps"),
    superior("Pull B · densidad", ["espalda", "hombros", "brazos"], "biceps"),
    inferior("Legs B · cadena posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]),
  ];
  const seis = [
    opcion("general_ppl_6", "PPL culturista A/B", "general", "empuje_traccion_piernas", "Las sesiones A/B tienen sesgos diferentes.", ppl),
    opcion("general_regional_6", "Regional frecuencia 2", "general", "regional", "Torso e inferiores se repiten con dominancias diferentes.", [superior("Pecho + amplitud", ["pecho", "espalda"]), inferior("Cuádriceps"), superior("Hombros + brazos", ["hombros", "brazos"], "ambos"), superior("Densidad + pecho", ["espalda", "pecho"]), inferior("Cadena posterior", ["femorales", "gluteos", "cuadriceps", "pantorrillas", "core"]), superior("Deltoides + brazos", ["hombros", "brazos"], "ambos")]),
  ];
  if (dias === 6) return seis;
  return seis.map((item) => ({ ...item, id: `${item.id}_7`, nombre: `${item.nombre} + accesorios`, diasEntrenamiento: 7, dias: [...item.dias, superior("Accesorios · brazos, pantorrillas y core", ["brazos", "pantorrillas", "core"], "ambos")] }));
}

export function categoriaProgramacionVipV2(entrevista: EntrevistaVipV2): DivisionCompetitivaV2 | "general" {
  return entrevista.competencia.compite === "si" && entrevista.competencia.division
    ? entrevista.competencia.division
    : "general";
}

export function opcionesDivisionSemanalVipV2(entrevista: EntrevistaVipV2, dias: number): OpcionDivisionVipV2[] {
  const categoria = categoriaProgramacionVipV2(entrevista);
  const especificas = dias === 5 && categoria !== "general" ? [...(CATEGORIA_5[categoria] ?? [])] : [];
  return [...especificas, ...opcionesBase(dias)];
}

export function seleccionarOpcionDivisionVipV2(entrevista: EntrevistaVipV2, dias: number): OpcionDivisionVipV2 {
  const opciones = opcionesDivisionSemanalVipV2(entrevista, dias);
  const elegida = entrevista.recursos.modoDivisionSemanal === "manual" && entrevista.recursos.divisionSemanalId
    ? opciones.find((item) => item.id === entrevista.recursos.divisionSemanalId)
    : null;
  return elegida ?? opciones[0];
}

export function auditarCompatibilidadDivisionVipV2(
  bloquesPorDia: ReadonlyArray<ReadonlyArray<{ grupo: GrupoDosisV2 }>>,
  division: OpcionDivisionVipV2,
): string[] {
  const violaciones: string[] = [];
  bloquesPorDia.forEach((bloques, indice) => {
    const reglaDia = division.dias[indice];
    if (!reglaDia) {
      violaciones.push(`El día ${indice + 1} no existe en la división ${division.nombre}.`);
      return;
    }
    for (const bloque of bloques) {
      if (!reglaDia.grupos.includes(bloque.grupo)) {
        violaciones.push(`${bloque.grupo} no está autorizado en ${reglaDia.nombre}.`);
      }
    }
  });
  return violaciones;
}
