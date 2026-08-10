import type {
  BriefGenerador,
  CardioModalidad,
  CategoriaCompetencia,
  EjercicioBorrador,
  EjercicioGenerador,
  EnfoqueForma,
  EtiquetaDia,
  GrupoEntrenable,
  InspiracionEstilo,
  IntensidadDeseada,
  ObjetivoEntrenamiento,
  PerfilEntrenamiento,
  RutinaGenerada,
  SubGrupoPierna,
  TecnicaEntrenamiento,
} from "./tipos";
import type { NivelEjercicio } from "@/lib/ejercicios/tipos";
import { validarSemanaVip } from "./validador-semanal";

/** Heurística por nombre — no hay un campo estructurado en `ejercicios` que
 * distinga "ancho" de "grosor" (se probó con `patron_movimiento`, existe la
 * columna pero está vacía en los 102 ejercicios reales). Basado en la
 * biblioteca real: jalones/aperturas/elevaciones laterales dan amplitud;
 * remos/pesos muertos/presses cerrados dan densidad. "definición" en cambio
 * sí usa un campo real (`categoria === "aislamiento"`), sin heurística. */
const PALABRAS_AMPLITUD = ["jalón", "jalon", "dominada", "pull-up", "pullover", "apertura", "cruce", "elevación lateral", "elevacion lateral", "face pull", "pájaro", "pajaro"];
const PALABRAS_DENSIDAD = ["remo", "peso muerto", "hip thrust", "press de banca", "press cerrado", "fondos", "curl", "sentadilla", "prensa", "hack squat", "buenos días", "buenos dias", "press militar"];

function coincideEnfoque(nombre: string, enfoque: EnfoqueForma, categoria: EjercicioGenerador["categoria"]): boolean {
  const n = nombre.toLowerCase();
  if (enfoque === "amplitud") return PALABRAS_AMPLITUD.some((p) => n.includes(p));
  if (enfoque === "densidad") return PALABRAS_DENSIDAD.some((p) => n.includes(p));
  if (enfoque === "definicion") return categoria === "aislamiento";
  return false;
}

/** Igual idea que el enfoque de forma, pero para separar "piernas" en sus
 * partes — el entrenador dijo que a veces junta glúteo+cuádriceps y a veces
 * los separa según los días disponibles. Tampoco hay columna estructurada
 * para esto, así que va por nombre. */
const SUBGRUPOS_PIERNA: SubGrupoPierna[] = ["gluteo", "cuadriceps", "femoral", "pantorrilla"];
const PALABRAS_SUBGRUPO: Record<SubGrupoPierna, string[]> = {
  gluteo: ["hip thrust", "puente de glúteo", "puente de gluteo", "frog pump", "patada de glúteo", "patada de gluteo", "extensión de cadera", "extension de cadera", "multi-hip", "sentadilla sumo", "peso muerto sumo", "pull through", "abductor"],
  cuadriceps: ["sentadilla", "prensa", "extensión de cuádriceps", "extension de cuadriceps", "zancada", "búlgara", "bulgara", "hack squat", "sissy squat", "subida al cajón", "subida al cajon", "belt squat"],
  femoral: ["curl femoral", "peso muerto rumano", "buenos días", "buenos dias", "kettlebell swing", "femoral"],
  pantorrilla: ["gemelo", "pantorrilla"],
};
const NOMBRE_SUBGRUPO: Record<SubGrupoPierna, string> = {
  gluteo: "Glúteo",
  cuadriceps: "Cuádriceps",
  femoral: "Femoral",
  pantorrilla: "Pantorrilla",
};

function esSubGrupoPierna(etiqueta: EtiquetaDia): etiqueta is SubGrupoPierna {
  return (SUBGRUPOS_PIERNA as string[]).includes(etiqueta);
}

function coincideSubGrupoPierna(nombre: string, sub: SubGrupoPierna): boolean {
  const n = nombre.toLowerCase();
  return PALABRAS_SUBGRUPO[sub].some((p) => n.includes(p));
}

type SubGrupoBrazo = "biceps" | "triceps";

/** Separación temporal sobre el catálogo actual. La base solo guarda
 * `grupoMuscular = brazos`, pero para programar un día de brazos necesitamos
 * garantizar que no quede, por ejemplo, con cinco curls y un solo tríceps.
 * Cuando el catálogo tenga el músculo objetivo estructurado, esta heurística
 * se reemplaza por ese dato sin cambiar el algoritmo de reparto. */
function subGrupoBrazo(nombre: string): SubGrupoBrazo | null {
  const n = normalizarNombre(nombre);
  if (["triceps", "extension", "press frances", "press cerrado", "fondos", "patada"].some((p) => n.includes(p))) return "triceps";
  if (["biceps", "curl", "predicador", "martillo"].some((p) => n.includes(p))) return "biceps";
  return null;
}

/** Minúsculas y sin tildes, para comparar nombres de ejercicios sin tener que
 * listar cada variante escrita ("cajón"/"cajon"). */
function normalizarNombre(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const NIVEL: Record<NivelEjercicio, number> = { principiante: 0, intermedio: 1, avanzado: 2 };

const NOMBRES_DIA: Record<string, string[]> = {
  vip_balanceada: ["Pecho + Bíceps", "Espalda + Tríceps", "Hombros + Piernas", "Pecho + Espalda", "Hombros + Brazos", "Piernas + Brazos", "Especialización VIP"],
  full_body: ["Cuerpo completo A", "Cuerpo completo B", "Cuerpo completo C", "Cuerpo completo D", "Cuerpo completo E", "Cuerpo completo F"],
  upper_lower: ["Tren superior A", "Tren inferior A", "Tren superior B", "Tren inferior B", "Tren superior C", "Tren inferior C"],
  push_pull_legs: ["Empuje", "Tracción", "Piernas", "Empuje B", "Tracción B", "Piernas B"],
};

const NOMBRE_GRUPO: Record<GrupoEntrenable, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
};

/** Para ordenar ejercicios dentro de un día con varios grupos combinados: de
 * músculo más grande a más chico (salvo que gane el grupo prioritario).
 * Pedido explícito: "si me pones a trabajar pecho, hombro y tríceps, lo
 * lógico es que vayas de músculo más grande a más chico". */
const TAMANO_GRUPO: Record<GrupoEntrenable, number> = {
  piernas: 5,
  espalda: 4,
  pecho: 3,
  hombros: 2,
  brazos: 1,
  core: 0,
};

const GRUPOS_SUPERIOR: GrupoEntrenable[] = ["pecho", "espalda", "hombros", "brazos"];
const GRUPOS_INFERIOR: GrupoEntrenable[] = ["piernas", "core"];
const GRUPOS_FULL_BODY: GrupoEntrenable[] = ["pecho", "espalda", "piernas", "hombros", "brazos", "core"];

/** Un "cupo" a llenar dentro de un día: un grupo muscular, opcionalmente
 * acotado a ciertas categorías (para separar tríceps/bíceps dentro de
 * "brazos" en un split empuje/tracción) o a una sub-parte de "piernas"
 * (glúteo/cuádriceps/femoral/pantorrilla). */
type CupoDia = { grupo: GrupoEntrenable; categorias?: EjercicioGenerador["categoria"][]; subGrupoPierna?: SubGrupoPierna; subGrupoBrazo?: SubGrupoBrazo };

function etiquetaCupo(c: CupoDia): string {
  if (c.subGrupoPierna) return NOMBRE_SUBGRUPO[c.subGrupoPierna];
  if (c.subGrupoBrazo === "biceps") return "Bíceps";
  if (c.subGrupoBrazo === "triceps") return "Tríceps";
  return NOMBRE_GRUPO[c.grupo];
}

function distribucionReal(brief: BriefGenerador): Exclude<BriefGenerador["distribucion"], "automatica"> {
  if (brief.distribucion !== "automatica") return brief.distribucion;
  if (brief.dias <= 2) return "full_body";
  if (brief.dias <= 6) return "vip_balanceada";
  return "push_pull_legs";
}

function categoriaEfectiva(brief: BriefGenerador, perfil: PerfilEntrenamiento): CategoriaCompetencia {
  return brief.categoriaCompetencia !== "ninguna"
    ? brief.categoriaCompetencia
    : perfil.categoriaCompetencia ?? "ninguna";
}

/** Cupos objetivo del día — reemplaza al viejo `correspondeDia`, que hacía un
 * sort global de "todo lo que no sea pierna" y por eso podía llenar un día
 * entero solo con espalda si esos ejercicios puntuaban más alto. Ahora cada
 * grupo tiene su propio cupo garantizado dentro del día. */
function cuposDelDia(brief: BriefGenerador, perfil: PerfilEntrenamiento, distribucion: string, indice: number): CupoDia[] {
  if (distribucion === "personalizada") {
    const etiquetas = brief.diaGrupos?.[indice] ?? GRUPOS_SUPERIOR.slice(0, 1);
    return etiquetas.map((etiqueta) =>
      esSubGrupoPierna(etiqueta) ? { grupo: "piernas" as const, subGrupoPierna: etiqueta } : { grupo: etiqueta }
    );
  }
  if (distribucion === "full_body") return GRUPOS_FULL_BODY.map((grupo) => ({ grupo }));
  if (distribucion === "vip_balanceada") {
    // Plantilla base del Método VIP: normalmente dos grupos por sesión,
    // frecuencia doble cuando los días lo permiten y una sesión de piernas
    // que puede convivir con hombros. No es una jaula: el entrenador puede
    // elegir personalizada, PPL, full body o upper/lower cuando corresponda.
    const plantillaBase: CupoDia[][] = [
      [{ grupo: "pecho" }, { grupo: "brazos", subGrupoBrazo: "biceps" }],
      [{ grupo: "espalda" }, { grupo: "brazos", subGrupoBrazo: "triceps" }],
      [{ grupo: "hombros" }, { grupo: "piernas" }],
      [{ grupo: "pecho" }, { grupo: "espalda" }],
      [{ grupo: "hombros" }, { grupo: "brazos" }],
      [{ grupo: "piernas" }, { grupo: "brazos" }],
    ];
    const categoria = categoriaEfectiva(brief, perfil);
    // La referencia visual modifica el énfasis semanal, no el objetivo del
    // bloque. Se traduce a grupos comprensibles y nunca elimina piernas ni
    // tren superior. Estas plantillas solo aplican al reparto VIP automático;
    // una distribución personalizada sigue siendo exactamente la del coach.
    const plantillaWellness: CupoDia[][] = [
      [{ grupo: "piernas", subGrupoPierna: "gluteo" }, { grupo: "hombros" }],
      [{ grupo: "espalda" }, { grupo: "brazos", subGrupoBrazo: "biceps" }],
      [{ grupo: "piernas", subGrupoPierna: "cuadriceps" }, { grupo: "brazos", subGrupoBrazo: "triceps" }],
      [{ grupo: "pecho" }, { grupo: "hombros" }],
      [{ grupo: "piernas", subGrupoPierna: "femoral" }, { grupo: "piernas", subGrupoPierna: "gluteo" }],
      [{ grupo: "espalda" }, { grupo: "brazos" }],
    ];
    const plantillaBikini: CupoDia[][] = [
      [{ grupo: "piernas", subGrupoPierna: "gluteo" }, { grupo: "hombros" }],
      [{ grupo: "espalda" }, { grupo: "brazos", subGrupoBrazo: "biceps" }],
      [{ grupo: "piernas", subGrupoPierna: "cuadriceps" }, { grupo: "core" }],
      [{ grupo: "pecho" }, { grupo: "brazos", subGrupoBrazo: "triceps" }],
      [{ grupo: "hombros" }, { grupo: "espalda" }],
      [{ grupo: "piernas", subGrupoPierna: "femoral" }, { grupo: "brazos" }],
    ];
    const plantillaSimetrica: CupoDia[][] = [
      ...plantillaBase.slice(0, 4),
      [{ grupo: "piernas" }, { grupo: "brazos" }],
      [{ grupo: "hombros" }, { grupo: "espalda" }],
    ];
    const plantilla = categoria === "wellness"
      ? plantillaWellness
      : categoria === "bikini"
        ? plantillaBikini
      : ["classic_physique", "bodybuilding_open", "womens_physique"].includes(categoria)
        ? plantillaSimetrica
          : plantillaBase;
    return plantilla[indice % plantilla.length];
  }
  if (distribucion === "upper_lower") {
    const grupos = indice % 2 === 1 ? GRUPOS_INFERIOR : GRUPOS_SUPERIOR;
    return grupos.map((grupo) => ({ grupo }));
  }
  // push_pull_legs: separa brazos por músculo objetivo para no mezclar
  // tríceps en tracción ni bíceps en empuje. La categoría "aislamiento"
  // por sí sola no alcanza porque contiene ejercicios de ambos músculos.
  const ciclo = indice % 3;
  if (ciclo === 0) return [{ grupo: "pecho" }, { grupo: "hombros" }, { grupo: "brazos", subGrupoBrazo: "triceps" }];
  if (ciclo === 1) return [{ grupo: "espalda" }, { grupo: "brazos", subGrupoBrazo: "biceps" }];
  return [{ grupo: "piernas" }, { grupo: "core" }];
}

function puntaje(e: EjercicioGenerador, brief: BriefGenerador, perfil: PerfilEntrenamiento, usados: Set<string>): number {
  let p = 0;
  if (brief.obligatorios.includes(e.id)) p += 1000;
  if (brief.preferidos.includes(e.id)) p += 80;
  if (!usados.has(e.id)) p += 25;
  if (e.posicionSesion === "principal") p += 20;
  if (brief.prioridad === "fuerza" && ["barra", "smith"].includes(e.equipo)) p += 15;
  if (brief.prioridad === "adherencia" && e.complejidad === "baja") p += 15;
  // La referencia visual elegida por alumno/coach sí orienta la selección.
  // El sexo no se usa como atajo: no suponemos que una mujer quiera bajar de
  // peso ni que un hombre quiera descuidar el tren inferior.
  const categoriaCompetencia = categoriaEfectiva(brief, perfil);
  if ((categoriaCompetencia === "bikini" || categoriaCompetencia === "wellness") && e.grupoMuscular === "piernas") p += 30;
  if (categoriaCompetencia === "wellness" && coincideSubGrupoPierna(e.nombre, "gluteo")) p += 20;
  if (categoriaCompetencia === "bikini" && ["hombros", "espalda"].includes(e.grupoMuscular)) p += 12;
  if (categoriaCompetencia === "mens_physique" && ["espalda", "hombros"].includes(e.grupoMuscular)) p += 30;
  if (categoriaCompetencia === "mens_physique" && ["pecho", "brazos"].includes(e.grupoMuscular)) p += 18;
  if (["classic_physique", "bodybuilding_open", "womens_physique"].includes(categoriaCompetencia) && ["pecho", "espalda", "hombros", "piernas"].includes(e.grupoMuscular)) p += 12;
  // Grupo rezagado que el entrenador quiere priorizar esta semana.
  if (brief.grupoPrioritario && e.grupoMuscular === brief.grupoPrioritario) p += 40;
  // Enfoque de forma: amplitud (ancho), densidad (grosor) o definición (aislados).
  if (brief.enfoqueForma !== "ninguno" && coincideEnfoque(e.nombre, brief.enfoqueForma, e.categoria)) p += 30;
  // Objetivo: rendimiento prioriza movimientos compuestos/funcionales.
  if (brief.objetivo === "rendimiento" && ["empuje", "traccion", "pierna", "full_body"].includes(e.categoria)) p += 15;
  // Inspiración de estilo: híbrido de tensión (CBum/Derek Lunsford/Cydney
  // Gillon) prioriza máquinas de alta estabilidad; científico (Jeff
  // Nippard/Francielle Mattos) prioriza aislados para parciales en rango
  // elongado.
  if (brief.inspiracionEstilo === "hibrido_tension" && ["maquina", "polea", "smith"].includes(e.equipo)) p += 15;
  if (brief.inspiracionEstilo === "cientifico_rir" && e.categoria === "aislamiento") p += 12;
  // Variedad respecto a la rutina anterior — que la próxima no sea calcada.
  // Penaliza, no excluye: si de verdad conviene repetirlo (obligatorio,
  // pocas alternativas), igual puede salir elegido.
  if (perfil.ejerciciosRecientes.includes(e.id)) p -= 35;
  return p;
}

function repsPorPrioridad(prioridad: BriefGenerador["prioridad"], principal: boolean): string {
  if (prioridad === "fuerza") return principal ? "4-6" : "8-10";
  if (prioridad === "hipertrofia") return principal ? "8-12" : "10-15";
  if (prioridad === "cardio") return "15-20";
  if (prioridad === "retorno" || prioridad === "tecnica") return "10-12";
  return principal ? "10-15" : "12-15";
}

/** El objetivo general del bloque (distinto de `prioridad`, que es el énfasis
 * puntual) también tiene que notarse en la prescripción — antes solo
 * cambiaba el nombre de la rutina. Pérdida de grasa sube el rango de reps
 * (más trabajo metabólico); rendimiento lo baja hacia fuerza-potencia. */
function ajustarRepsPorObjetivo(reps: string, objetivo: ObjetivoEntrenamiento, principal: boolean): string {
  if (objetivo === "perdida_grasa") return principal ? "12-15" : "15-20";
  if (objetivo === "rendimiento") return principal ? "5-8" : "8-10";
  return reps;
}

/** RIR (repeticiones en reserva) explícito para el enfoque científico
 * (Jeff Nippard / Francielle Mattos: "regulación de fatiga mediante RIR"). */
function conRirSiCorresponde(reps: string, inspiracion: InspiracionEstilo, principal: boolean): string {
  if (inspiracion !== "cientifico_rir") return reps;
  return `${reps} (RIR ${principal ? "1-2" : "0-1"})`;
}

/** Los compuestos principales de las rutinas avanzadas reales suelen usar
 * pirámides descendentes. Solo se aplican con intensidad alta/competitiva;
 * los demás perfiles conservan rangos simples. */
function repsEscalonadas(
  reps: string,
  series: number,
  experiencia: NivelEjercicio,
  intensidad: IntensidadDeseada,
  objetivo: ObjetivoEntrenamiento,
  principal: boolean
): string {
  if (
    experiencia !== "avanzado" ||
    intensidad === "estandar" ||
    !principal ||
    !["hipertrofia", "recomposicion"].includes(objetivo)
  ) return reps;
  if (series >= 5) return "15-12-10-8-8";
  if (series === 4) return "15-12-10-8";
  if (series === 3) return "12-10-8";
  return reps;
}

function descansoPorPrioridad(prioridad: BriefGenerador["prioridad"], principal: boolean): number {
  if (prioridad === "fuerza") return principal ? 120 : 75;
  if (prioridad === "hipertrofia" || prioridad === "cardio") return principal ? 90 : 60;
  return 90;
}

/** Series por ejercicio según experiencia + intensidad deseada.
 * Principiante: 3-4 series (4-5 ejercicios totales por sesión, a definir por
 * el entrenador vía `ejerciciosPorSesion`). Intermedio: 3 series (≈18 series
 * en una sesión de 6 ejercicios). Avanzado: 4, y sube a 5 en los principales
 * si pidió intensidad alta/competitiva (≈21+ series), acercándose al
 * volumen/densidad de un entrenamiento de competencia. */
function seriesPorNivel(experiencia: NivelEjercicio, intensidad: IntensidadDeseada, principal: boolean): number {
  if (experiencia === "principiante") return principal ? 4 : 3;
  if (experiencia === "intermedio") return principal ? 3 : 3;
  const base = principal ? 4 : 3;
  return intensidad === "estandar" ? base : base + 1;
}

/** Ajuste de series por objetivo e inspiración de estilo, con piso de 2 —
 * "mantención" (menos volumen, ya no está en fase de progresión activa) y
 * "alta intensidad" (Nick Walker/Hadi Choopan: pocas series al fallo) bajan;
 * "volumen tradicional" (Sam Sulek/Dana Linn Bailey: bro-split de alto
 * volumen) sube. */
function ajusteSeries(series: number, objetivo: ObjetivoEntrenamiento, inspiracion: InspiracionEstilo): number {
  let delta = 0;
  if (objetivo === "mantencion") delta -= 1;
  if (inspiracion === "alta_intensidad") delta -= 1;
  if (inspiracion === "volumen_tradicional") delta += 1;
  return Math.max(2, series + delta);
}

/** El estándar por defecto del entrenador es exigente (alta densidad, nivel
 * culturismo de élite) — esto es lo que lo atempera con la edad real del
 * alumno. 50s todavía aguanta el volumen completo; 60s baja un poco;
 * 70+ baja más — nunca corta antes del piso de 2 series. */
function ajusteEdad(series: number, edad: number | null): number {
  if (edad === null) return series;
  if (edad >= 70) return Math.max(2, series - 2);
  if (edad >= 60) return Math.max(2, series - 1);
  return series;
}

function prescripcion(
  brief: BriefGenerador,
  perfil: PerfilEntrenamiento,
  e: EjercicioGenerador
): Pick<EjercicioBorrador, "series" | "reps" | "descansoSegundos"> {
  const principal = e.posicionSesion === "principal" || ["empuje", "traccion", "pierna", "full_body"].includes(e.categoria);
  const experiencia = perfil.experiencia ?? "principiante";
  const intensidad = brief.intensidadDeseada;
  const series = ajusteEdad(ajusteSeries(seriesPorNivel(experiencia, intensidad, principal), brief.objetivo, brief.inspiracionEstilo), perfil.edad);
  const repsBase = ajustarRepsPorObjetivo(repsPorPrioridad(brief.prioridad, principal), brief.objetivo, principal);
  const repsPeriodizadas = repsEscalonadas(repsBase, series, experiencia, intensidad, brief.objetivo, principal);
  return {
    series,
    reps: conRirSiCorresponde(repsPeriodizadas, brief.inspiracionEstilo, principal),
    descansoSegundos: principal && experiencia === "avanzado"
      ? Math.max(120, descansoPorPrioridad(brief.prioridad, principal))
      : descansoPorPrioridad(brief.prioridad, principal),
  };
}

/** Cada ejercicio sale con el recordatorio técnico que Alejandro suele
 * escribir en sus entregas, en vez de dejar una fila muda. */
export function indicacionTecnica(nombre: string, grupo: EjercicioGenerador["grupoMuscular"]): string {
  const n = normalizarNombre(nombre);
  if (/sentadilla|squat|prensa|hack|belt/.test(n)) return "Controla la bajada, mantén las rodillas alineadas y empuja con todo el pie.";
  if (/hip thrust|puente|patada|abdu|multi hip/.test(n)) return "Mantén la pelvis estable y aprieta el glúteo arriba sin arquear la zona lumbar.";
  if (/peso muerto|rumano|buenos dias/.test(n)) return "Lleva la cadera atrás, conserva la columna neutra y controla la fase excéntrica.";
  if (/femoral/.test(n)) return "Fija la cadera al apoyo y controla especialmente el regreso del peso.";
  if (/jalon|dominada|pull.?up/.test(n)) return "Lleva los codos hacia las costillas y evita balancear el torso.";
  if (/remo/.test(n)) return "Mantén el tronco estable y termina juntando las escápulas sin tirones.";
  if (/elevacion.*lateral|pajaro|reverse pec|face pull/.test(n)) return "Trabaja sin impulso y controla la bajada para mantener tensión en el hombro.";
  if (/press.*hombro|press militar|shoulder press/.test(n)) return "Aprieta el abdomen, mantén los codos estables y controla la bajada.";
  if (/press|apertura|cruce|fondos/.test(n) && grupo === "pecho") return "Fija las escápulas, controla el descenso y evita rebotar al empujar.";
  if (/curl|predicador|martillo/.test(n)) return "Mantén los codos fijos y evita balancear el tronco.";
  if (/triceps|extension|press frances|pushdown/.test(n)) return "Mantén los codos fijos y completa la extensión sin mover los hombros.";
  if (grupo === "core") return "Mantén el abdomen activo y evita compensar con la zona lumbar.";
  return "Usa un recorrido controlado, técnica limpia y sin rebotes.";
}

function activacionDelDia(cupos: CupoDia[], perfil: PerfilEntrenamiento): string {
  const grupos = new Set(cupos.map((c) => c.grupo));
  const piernas = grupos.has("piernas");
  const superior = ["pecho", "espalda", "hombros", "brazos"].some((g) => grupos.has(g as GrupoEntrenable));
  const base = piernas && superior
    ? "Activación: 5-8 min de bicicleta y movilidad general; completa 1-2 series livianas del primer movimiento."
    : piernas
      ? "Activación: 5-8 min de bicicleta, movilidad de cadera/tobillo y trabajo suave de glúteos con banda."
      : "Activación: 5 min de bicicleta o remo, movilidad escapular y 1-2 series livianas del primer movimiento.";
  return perfil.requiereRevision
    ? `${base} Todo debe realizarse sin dolor y respetando las restricciones confirmadas por el entrenador.`
    : base;
}

/** Llena `cantidad` cupos repartidos entre `cupos`, garantizando que cada
 * grupo objetivo aparezca (cuota mínima) antes de rellenar con lo que sobre.
 * Esto es lo que evita que un día "tren superior" termine siendo solo
 * espalda: cada grupo tiene su propio balde. */
function elegirPorCupos(
  candidatos: EjercicioGenerador[],
  cupos: CupoDia[],
  cantidad: number,
  brief: BriefGenerador,
  perfil: PerfilEntrenamiento,
  usados: Set<string>
): EjercicioGenerador[] {
  if (cupos.length === 0 || cantidad <= 0) return [];
  const porCupo = cupos.map((c) =>
    candidatos
      .filter(
        (e) =>
          e.grupoMuscular === c.grupo &&
          (!c.categorias || c.categorias.includes(e.categoria)) &&
          (!c.subGrupoPierna || coincideSubGrupoPierna(e.nombre, c.subGrupoPierna)) &&
          (!c.subGrupoBrazo || subGrupoBrazo(e.nombre) === c.subGrupoBrazo)
      )
      .sort((a, b) => puntaje(b, brief, perfil, usados) - puntaje(a, brief, perfil, usados))
  );
  const base = Math.floor(cantidad / cupos.length);
  const cupoAsignado = porCupo.map(() => base);
  let restante = cantidad - base * cupos.length;
  // El cupo extra (cuando no divide exacto) va a los grupos con más
  // candidatos disponibles, para no pedirle un 2º ejercicio a un grupo que
  // solo tiene uno en la biblioteca.
  const ordenExtra = porCupo.map((lista, i) => i).sort((a, b) => porCupo[b].length - porCupo[a].length);
  for (const i of ordenExtra) {
    if (restante <= 0) break;
    cupoAsignado[i] += 1;
    restante--;
  }

  const elegidos: EjercicioGenerador[] = [];
  porCupo.forEach((lista, i) => {
    const cantidadCupo = cupoAsignado[i];
    const cupo = cupos[i];
    if (cupo.grupo !== "brazos" || cupo.subGrupoBrazo || cantidadCupo < 2) {
      elegidos.push(...lista.slice(0, cantidadCupo));
      return;
    }

    // Un día general de brazos reparte sus espacios entre bíceps y tríceps
    // antes de completar con ejercicios sin clasificar. Con 4 espacios quedan
    // al menos 2+2 si el catálogo lo permite; con 2, al menos 1+1.
    const biceps = lista.filter((e) => subGrupoBrazo(e.nombre) === "biceps");
    const triceps = lista.filter((e) => subGrupoBrazo(e.nombre) === "triceps");
    const seleccionados: EjercicioGenerador[] = [
      ...biceps.slice(0, Math.floor(cantidadCupo / 2)),
      ...triceps.slice(0, Math.floor(cantidadCupo / 2)),
    ];
    for (const ejercicio of lista) {
      if (seleccionados.length >= cantidadCupo) break;
      if (!seleccionados.some((e) => e.id === ejercicio.id)) seleccionados.push(ejercicio);
    }
    elegidos.push(...seleccionados);
  });

  if (elegidos.length < cantidad) {
    const yaElegidos = new Set(elegidos.map((e) => e.id));
    const sobrantes = porCupo.flat().filter((e) => !yaElegidos.has(e.id));
    for (const e of sobrantes) {
      if (elegidos.length >= cantidad) break;
      if (!elegidos.some((x) => x.id === e.id)) elegidos.push(e);
    }
  }
  return elegidos;
}

const ORDEN_POSICION: Record<NonNullable<EjercicioGenerador["posicionSesion"]>, number> = {
  activacion: 0,
  principal: 1,
  accesorio: 2,
  finalizador: 3,
  cardio: 4,
};

/** El entrenador puede forzar sí/no sin importar el nivel — pidió poder
 * meterle técnicas a un principiante o estándar si lo cree conveniente. La
 * seguridad no depende de esta decisión: `aplicarTecnicasDelDia` filtra por
 * `nivelMinimo` de cada técnica, así que a un principiante nunca le va a
 * tocar un rest-pause o drop-set, aunque haya pedido "sí". */
/** Antes exigía "avanzado" para CUALQUIER técnica, así que un alumno
 * intermedio (el nivel más común) nunca recibía ni biserie ni superserie
 * — quedaban reservadas a un tier que casi nadie pedía. Bug reportado por
 * el entrenador: "no está cargando las biseries". Ahora principiante keda
 * fuera por defecto (solo entra si se fuerza "sí" a mano) e intermedio y
 * avanzado sí evalúan técnicas siempre — cuáles concretas le tocan a cada
 * uno lo decide `nivelMinimo` de cada técnica en `aplicarTecnicasDelDia`. */
function aplicaTecnicas(experiencia: NivelEjercicio, brief: BriefGenerador): boolean {
  if (brief.tecnicasIntensidad === "no") return false;
  if (brief.tecnicasIntensidad === "si") return true;
  return experiencia !== "principiante";
}

/** Reparte técnicas de intensidad reales (drop-set, rest-pause, biserie,
 * superserie…) sobre los ejercicios accesorios/finalizadores del día —
 * nunca sobre el primer compuesto principal. Antes `tecnicaTipo` siempre
 * quedaba en null: la tabla `tecnicas_entrenamiento` existía pero nada la
 * leía; y cuando se empezó a leer, las encadenadas (biserie/superserie)
 * solo entraban en el tier "competitiva" — demasiado alto para su
 * nivel_minimo real ("intermedio" en el seed). Ahora cualquier intermedio+
 * con 2 accesorios en el día arma una biserie/superserie; triserie/circuito
 * (fatiga alta, requieren supervisión) se reservan para competitiva. */
/** Memoria de la semana para repartir las técnicas.
 *
 * Antes esto no existía: cada día se resolvía solo, así que la misma técnica
 * (la de mayor fatiga disponible) caía en los mismos dos accesorios de TODOS
 * los días. Corrección del entrenador: "las técnicas van distribuidas entre
 * los días y la semana, no es que en un día vas a meter todas las técnicas".
 * Ahora se rota por la menos usada y se evita repetir la del día anterior. */
export type EstadoTecnicasSemana = { usos: Map<string, number>; ultima: string | null };

export function estadoTecnicasInicial(): EstadoTecnicasSemana {
  return { usos: new Map(), ultima: null };
}

/** Qué días de la semana llevan técnica. No todos: un estándar las recibe en
 * la mitad de los días, un competitivo en todos. Se reparten parejo (día 1 y
 * 3 de 4, no los dos primeros seguidos) para que la semana tenga picos y
 * valles, que es como se programa de verdad. */
export function diaLlevaTecnica(indiceDia: number, totalDias: number, intensidad: BriefGenerador["intensidadDeseada"]): boolean {
  if (totalDias <= 0) return false;
  const proporcion = intensidad === "competitiva" ? 1 : intensidad === "alta" ? 0.75 : 0.5;
  const diasConTecnica = Math.max(1, Math.round(totalDias * proporcion));
  // Reparto parejo: el día i la lleva cuando le toca el siguiente "cupo"
  // según el avance proporcional, no por ser de los primeros.
  return Math.floor(((indiceDia + 1) * diasConTecnica) / totalDias) > Math.floor((indiceDia * diasConTecnica) / totalDias);
}

/** Dosis máxima de familias de intensidad en una sesión. Una biserie cuenta
 * como una familia aunque marque dos ejercicios. La firma VIP es exigente,
 * pero no acumula técnicas sin límite sobre volumen alto. */
export function maximoTecnicasPorSesion(
  experiencia: NivelEjercicio,
  intensidad: BriefGenerador["intensidadDeseada"]
): number {
  if (experiencia === "principiante") return 1;
  if (experiencia === "intermedio") return intensidad === "competitiva" ? 2 : 1;
  return intensidad === "estandar" ? 1 : 2;
}

function aplicarTecnicasDelDia(
  ejercicios: EjercicioBorrador[],
  tecnicas: TecnicaEntrenamiento[],
  experiencia: NivelEjercicio,
  brief: BriefGenerador,
  semana: EstadoTecnicasSemana
) {
  const nivelMax = NIVEL[experiencia];
  const competitiva = brief.intensidadDeseada === "competitiva";
  const maximoFamilias = maximoTecnicasPorSesion(experiencia, brief.intensidadDeseada);
  let familiasAplicadas = 0;
  const usosEnDia = new Map<string, number>();
  // Si el entrenador marcó técnicas puntuales a mano, solo esas entran —
  // aunque el nivel del alumno permitiera otras.
  const permitidas = new Set(brief.tecnicasPermitidas);
  const fatigaRango = (t: TecnicaEntrenamiento) => (t.fatiga === "alta" ? 2 : t.fatiga === "media" ? 1 : 0);
  const disponibles = (tipo: TecnicaEntrenamiento["tipo"]) => {
    const aptas = tecnicas.filter(
      (t) =>
        t.tipo === tipo &&
        NIVEL[t.nivelMinimo] <= nivelMax &&
        (usosEnDia.get(t.slug) ?? 0) < t.maximoPorSesion &&
        (permitidas.size === 0 || permitidas.has(t.slug))
    );
    // Rotación semanal: primero la menos usada en la semana; a igualdad, la
    // de más fatiga (que es la que "define" el estilo). La del día anterior
    // se manda al final, pero no se descarta: si es la única, igual entra.
    const noRepetida = aptas.filter((t) => t.slug !== semana.ultima);
    const orden = (lista: TecnicaEntrenamiento[]) =>
      [...lista].sort((a, b) => (semana.usos.get(a.slug) ?? 0) - (semana.usos.get(b.slug) ?? 0) || fatigaRango(b) - fatigaRango(a));
    return [...orden(noRepetida), ...orden(aptas.filter((t) => t.slug === semana.ultima))];
  };
  const registrar = (t: TecnicaEntrenamiento) => {
    usosEnDia.set(t.slug, (usosEnDia.get(t.slug) ?? 0) + 1);
    semana.usos.set(t.slug, (semana.usos.get(t.slug) ?? 0) + 1);
    semana.ultima = t.slug;
    familiasAplicadas += 1;
  };

  const noCardio = ejercicios.filter((e) => e.grupoMuscular !== "cardio");
  const accesorios = noCardio.filter((e) => e.orden !== noCardio[0]?.orden);

  // Encadenada (biserie/superserie) desde intermedio; triserie/circuito
  // (fatiga alta) solo si pidió intensidad competitiva. "Alta intensidad"
  // (estilo Nick Walker/Hadi Choopan: pocas series al fallo, sin acumular
  // volumen con superseries) la salta a propósito — va directo a la técnica
  // individual de abajo (drop-set/rest-pause), que es la que define ese estilo.
  if (nivelMax >= NIVEL.intermedio && accesorios.length >= 2 && brief.inspiracionEstilo !== "alta_intensidad") {
    const tecnica = disponibles("encadenada")
      .filter((t) => competitiva || t.fatiga !== "alta")
      .find((t) => (t.cantidadEjercicios ?? 2) <= accesorios.length);
    if (tecnica) {
      registrar(tecnica);
      const bloque = accesorios.slice(-(tecnica.cantidadEjercicios ?? 2));
      bloque.forEach((ejercicio, indice) => {
        const siguiente = bloque[indice + 1];
        ejercicio.tecnicaTipo = tecnica.nombre;
        ejercicio.tecnicaInstruccion = siguiente
          ? `Enlaza sin descanso con "${siguiente.nombre}".`
          : `Cierra la ${tecnica.nombre.toLowerCase()} y descansa antes de repetir el bloque.`;
        ejercicio.descansoSegundos = siguiente ? tecnica.descansoInternoSeg : tecnica.descansoFinalSeg;
      });
    }
  }

  // En intensidad alta/competitiva, un avanzado puede recibir una segunda
  // familia individual sobre otro accesorio. En estándar, una biserie ya
  // consume toda la dosis del día. Nunca se usa el compuesto principal.
  const ultimo = [...accesorios].reverse().find((e) => !e.tecnicaTipo);
  if (ultimo && familiasAplicadas < maximoFamilias) {
    const tecnica = disponibles("individual")[0];
    if (tecnica) {
      registrar(tecnica);
      ultimo.tecnicaTipo = tecnica.nombre;
      // Siempre queda claro EN QUÉ SERIE va la técnica: el entrenador lee la
      // rutina como "nombre, series, reps, descanso y técnica —por ejemplo,
      // en la última serie es un drop set—", no como una nota suelta.
      if (tecnica.slug === "fst-7") {
        ultimo.series = 7;
        ultimo.reps = "10-15";
      }
      ultimo.tecnicaInstruccion =
        tecnica.slug === "fst-7"
          ? "Remate FST-7: 7 series de 10-15 reps con 30s de descanso, técnica limpia y contracción máxima."
          : tecnica.slug === "myo-reps"
            ? "Última serie: llega cerca del fallo, descansa 15s y completa 3-4 mini-series de 3-5 reps."
          : tecnica.slug === "drop-set"
          ? "Última serie: al fallo, baja el peso ~20% sin descanso y sigue hasta el fallo otra vez."
          : tecnica.slug === "rest-pause"
            ? "Última serie: al fallo, descansa 15-20s de pie y suma reps con el mismo peso."
            : tecnica.slug === "fallo-muscular"
              ? "Última serie: llévala al fallo técnico real, sin dejar reps en reserva."
              : `Última serie: aplicar ${tecnica.nombre.toLowerCase()}.`;
      ultimo.descansoSegundos = tecnica.descansoFinalSeg;
    }
  }
}

/** Palabras con las que se reconoce cada modalidad de cardio en el catálogo.
 * Misma heurística por nombre que los sub-grupos de pierna: `ejercicios` no
 * tiene una columna de "modalidad de cardio", y agregarla obligaría a
 * reclasificar a mano toda la biblioteca. */
const PALABRAS_CARDIO: Record<Exclude<CardioModalidad, "ninguno" | "indistinto">, string[]> = {
  spinning: ["spinning", "bicicleta", "bici", "ciclo"],
  caminadora: ["caminadora", "trotadora", "cinta", "caminata", "trote"],
  steps: ["step", "cajon", "cajón", "escalador", "escaladora", "subida"],
  // Ojo: "escalador" NO va acá aunque exista "Escaladora" en la biblioteca —
  // esa es una máquina y pertenece a `steps`, no al circuito funcional.
  funcional: [
    "burpee", "cuerda", "jumping", "slam", "wall ball", "wallball", "trx",
    "mountain", "salto", "battle", "remo ergo", "sled", "kettlebell",
  ],
};

function esModalidad(nombre: string, modalidad: Exclude<CardioModalidad, "ninguno" | "indistinto">): boolean {
  const n = normalizarNombre(nombre);
  return PALABRAS_CARDIO[modalidad].some((p) => n.includes(normalizarNombre(p)));
}

/** Qué modalidades de cardio puede ofrecer el generador HOY, según lo que de
 * verdad está activo en la biblioteca.
 *
 * No se ofrece "caminadora" si el gimnasio no tiene caminadora: sería una
 * opción que no genera nada, y peor, le prometería al alumno una máquina que
 * no va a encontrar. La lista de modalidades sale del catálogo, no de una
 * constante escrita a mano. */
export function modalidadesCardioDisponibles(
  nombresCardio: string[]
): Exclude<CardioModalidad, "ninguno" | "indistinto">[] {
  const todas = ["spinning", "caminadora", "steps", "funcional"] as const;
  return todas.filter((m) => nombresCardio.some((n) => esModalidad(n, m)));
}

type BloqueCardio = {
  ejercicio: EjercicioGenerador;
  series: number;
  reps: string;
  descansoSegundos: number;
  observacion: string;
};

/** Cardio al final del día, con la modalidad que eligió el entrenador.
 *
 * "Funcional" no es una máquina sino un circuito: se arman varias estaciones
 * cortas (burpees, cuerda, slam ball…) en vez de un solo bloque continuo, y
 * rotan de un día a otro para que la semana no sea el mismo circuito cinco
 * veces. Las máquinas (spinning, caminadora, steps) sí van como un bloque
 * único de los minutos pedidos. */
function elegirCardio(brief: BriefGenerador, disponibles: EjercicioGenerador[], indiceDia: number): BloqueCardio[] {
  if (brief.cardio === "ninguno" || disponibles.length === 0) return [];

  if (brief.cardio === "funcional") {
    // Los que marcó el entrenador, en el orden en que están en la biblioteca.
    // Sin marcar ninguno, entran los funcionales que haya.
    const elegidos = brief.cardioEjercicios.length > 0
      ? disponibles.filter((e) => brief.cardioEjercicios.includes(e.id))
      : disponibles.filter((e) => esModalidad(e.nombre, "funcional"));
    if (elegidos.length === 0) return [];

    // "Separado": cada movimiento es su propio bloque, con descanso real entre
    // series. No es un circuito, son ejercicios de cardio uno tras otro.
    if (brief.cardioFormato === "separado") {
      const minutosPorEjercicio = Math.max(2, Math.round(brief.cardioMinutos / elegidos.length));
      return elegidos.map((ejercicio) => ({
        ejercicio,
        series: 3,
        reps: "40s",
        descansoSegundos: 60,
        observacion: `Cardio al finalizar, por separado (~${minutosPorEjercicio} min en este).`,
      }));
    }

    // "Circuito": todas las estaciones marcadas, seguidas y con descanso corto
    // entre una y otra. Se hacen todas — el entrenador ya decidió cuáles al
    // marcarlas, no le corresponde al motor recortar la lista.
    const estaciones = elegidos.length;
    const minutosPorEstacion = brief.cardioMinutos / estaciones;
    return elegidos.map((ejercicio) => ({
      ejercicio,
      series: 3,
      reps: minutosPorEstacion > 4 ? "45s" : "30s",
      descansoSegundos: 30,
      observacion: `Circuito al finalizar: ${estaciones} estaciones seguidas, 3 vueltas (~${brief.cardioMinutos} min).`,
    }));
  }

  const candidatos = brief.cardio === "indistinto"
    ? disponibles
    : disponibles.filter((e) => esModalidad(e.nombre, brief.cardio as Exclude<CardioModalidad, "ninguno" | "indistinto" | "funcional">));
  // Rotar entre las máquinas disponibles de esa modalidad si hay más de una.
  const ejercicio = (candidatos.length > 0 ? candidatos : disponibles)[indiceDia % (candidatos.length > 0 ? candidatos.length : disponibles.length)];
  if (!ejercicio) return [];
  return [{
    ejercicio,
    series: 1,
    reps: `${brief.cardioMinutos} min`,
    descansoSegundos: 0,
    observacion: "Cardio al finalizar la sesión.",
  }];
}

/** El tiempo sugiere el tamaño de la sesión, pero no convierte una sesión
 * larga en una colección interminable de variantes. A partir de 80 minutos,
 * el tiempo extra sirve para calentamiento, aproximaciones, descansos y una
 * ejecución intensa: el Método VIP limita el bloque a ocho ejercicios. */
export function ejerciciosPorTiempo(minutosSesion: number, cardioMinutos = 0): number {
  const minutosFuerza = Math.max(20, minutosSesion - cardioMinutos);
  return Math.min(8, Math.max(3, Math.round(minutosFuerza / 10)));
}

/** En días enfocados de uno o dos grupos, más de tres ejercicios por grupo
 * suele duplicar patrones y dispara el volumen semanal. Un día de un solo
 * músculo puede llegar a seis; con dos músculos quedan tres y tres. */
export function ejerciciosObjetivoDelDia(solicitados: number, cantidadGrupos: number): number {
  if (cantidadGrupos <= 0) return 0;
  return Math.min(solicitados, cantidadGrupos <= 2 ? 6 : 8);
}

export function generarRutinaPorReglas(
  perfil: PerfilEntrenamiento,
  brief: BriefGenerador,
  biblioteca: EjercicioGenerador[],
  tecnicas: TecnicaEntrenamiento[] = []
): RutinaGenerada {
  const alertas: string[] = [];
  const reglasAplicadas = ["Solo ejercicios activos de la biblioteca VIP", "Cardio ubicado al final", "Publicación sujeta a aprobación del entrenador"];
  if (perfil.requiereRevision || perfil.lesionesDiagnosticadas || perfil.condicionesMedicas) {
    alertas.push("El perfil contiene antecedentes que requieren revisión del entrenador antes de publicar.");
  }

  const experiencia = perfil.experiencia ?? "principiante";
  const maxNivel = NIVEL[experiencia];
  const prohibidos = new Set(brief.prohibidos);
  let candidatos = biblioteca.filter((e) => {
    if (prohibidos.has(e.id) || e.grupoMuscular === "cardio") return false;
    if (NIVEL[e.nivel] > maxNivel) return false;
    if (brief.evitarSaltos && (e.requiereSalto || e.impacto === "alto")) return false;
    return true;
  });

  // Catálogo de cardio, aparte de los candidatos de fuerza (que excluyen el
  // grupo "cardio" arriba). El filtro de saltos también aplica acá: burpees y
  // salto de cuerda son de impacto alto.
  const cardioDisponible = biblioteca.filter(
    (e) =>
      e.grupoMuscular === "cardio" &&
      !prohibidos.has(e.id) &&
      (!brief.evitarSaltos || (!e.requiereSalto && e.impacto !== "alto"))
  );
  const semanaTecnicas = estadoTecnicasInicial();

  // Un obligatorio tiene prioridad, pero no autoridad para saltarse seguridad.
  // Antes se reincorporaba desde la biblioteca completa y podía reintroducir
  // un ejercicio de nivel superior o de impacto alto que ya había sido filtrado.
  const idsCandidatos = new Set(candidatos.map((e) => e.id));
  const obligatoriosValidos = biblioteca.filter((e) => brief.obligatorios.includes(e.id) && idsCandidatos.has(e.id));
  const obligatoriosIncompatibles = brief.obligatorios.filter((id) => !idsCandidatos.has(id));
  if (obligatoriosIncompatibles.length > 0) {
    alertas.push(`${obligatoriosIncompatibles.length} ejercicio${obligatoriosIncompatibles.length === 1 ? " obligatorio es incompatible" : "s obligatorios son incompatibles"} con el nivel o los filtros elegidos y no se incluyó.`);
  }
  candidatos = [...obligatoriosValidos, ...candidatos.filter((e) => !brief.obligatorios.includes(e.id))];
  if (candidatos.length === 0) throw new Error("No hay ejercicios compatibles con todos los filtros elegidos.");

  const distribucion = distribucionReal(brief);
  const categoriaCompetencia = categoriaEfectiva(brief, perfil);
  reglasAplicadas.push(`Distribución ${distribucion.replaceAll("_", " ")}`);
  if (distribucion === "personalizada") reglasAplicadas.push("Grupos musculares por día elegidos a mano por el entrenador");
  if (brief.evitarSaltos) reglasAplicadas.push("Sin ejercicios de salto o impacto alto");
  reglasAplicadas.push(`Sesión de ${brief.minutosSesion} min: hasta ${brief.ejerciciosPorSesion} ejercicios de fuerza por día, con máximo VIP de 3 variantes por grupo en días combinados${brief.cardio !== "ninguno" ? ` + ${brief.cardioMinutos} min de cardio` : ""}`);
  if (brief.cardio !== "ninguno") {
    const etiquetaCardio = { spinning: "bicicleta de spinning", caminadora: "caminadora", steps: "steps", funcional: "circuito funcional (rota los movimientos día a día)", indistinto: "cardio disponible en sala" }[brief.cardio];
    reglasAplicadas.push(`Cardio: ${etiquetaCardio}, al final de la sesión`);
    if (cardioDisponible.length === 0) alertas.push("No hay ejercicios de cardio en la biblioteca que cumplan los filtros; la rutina quedó sin cardio.");
  }
  const seriesEjemplo = seriesPorNivel(experiencia, brief.intensidadDeseada, true);
  reglasAplicadas.push(`Volumen para nivel ${experiencia}: ${seriesEjemplo} series en ejercicios principales`);
  reglasAplicadas.push("Progresión VIP de 4 semanas: establecer cargas, sumar repeticiones, acercarse a RIR 0-1 y consolidar antes de cambiar el bloque");
  reglasAplicadas.push("Cada sesión incluye activación específica y cada ejercicio lleva una indicación técnica breve");
  if (categoriaCompetencia !== "ninguna") {
    const enfoqueCategoria: Record<Exclude<CategoriaCompetencia, "ninguna">, string> = {
      bikini: "proporción atlética y definida, con énfasis inferior y hombros/espalda equilibrados",
      wellness: "piernas y glúteos protagonistas, manteniendo el tren superior equilibrado",
      mens_physique: "amplitud de espalda y hombros, con pecho y brazos marcados sin omitir piernas",
      classic_physique: "simetría y equilibrio muscular de cuerpo completo",
      bodybuilding_open: "desarrollo muscular global, sin dejar grupos rezagados",
      womens_physique: "desarrollo muscular fuerte, definido y equilibrado de cuerpo completo",
    };
    reglasAplicadas.push(`Referencia física ${categoriaCompetencia.replaceAll("_", " ")}: ${enfoqueCategoria[categoriaCompetencia]}; validada por el entrenador`);
  }
  if (perfil.edad !== null && perfil.edad >= 60) {
    reglasAplicadas.push(`Volumen ajustado por edad (${perfil.edad} años): ${perfil.edad >= 70 ? "-2" : "-1"} series por ejercicio respecto al estándar del nivel`);
  }
  if (perfil.ejerciciosRecientes.length > 0) reglasAplicadas.push("Se evitaron, cuando fue posible, los ejercicios de la rutina anterior de este alumno para variar el estímulo");
  if (brief.grupoPrioritario) reglasAplicadas.push(`${NOMBRE_GRUPO[brief.grupoPrioritario]} como grupo prioritario: se entrena primero los días que aparece`);
  if (brief.enfoqueForma !== "ninguno") {
    const etiqueta = { amplitud: "amplitud (ancho)", densidad: "densidad (grosor)", definicion: "definición (aislados)" }[brief.enfoqueForma];
    reglasAplicadas.push(`Enfoque de forma: se priorizan ejercicios de ${etiqueta}`);
  }
  // El objetivo del bloque (distinto de la prioridad puntual) también ajusta
  // reps/series — antes solo cambiaba el nombre de la rutina.
  if (brief.objetivo === "perdida_grasa") {
    reglasAplicadas.push("Objetivo pérdida de grasa: reps más altas (12-20) para más trabajo metabólico");
    if (brief.cardio === "ninguno") alertas.push("El objetivo es pérdida de grasa pero no se agregó cardio; conviene sumar al menos cardio bajo.");
  }
  if (brief.objetivo === "rendimiento") reglasAplicadas.push("Objetivo rendimiento: reps más bajas (5-8) y prioridad a movimientos compuestos/funcionales");
  if (brief.objetivo === "mantencion") reglasAplicadas.push("Objetivo mantención: una serie menos por ejercicio (no está en fase de progresión activa)");
  if (brief.inspiracionEstilo !== "ninguna") {
    const nota = {
      alta_intensidad: "alta intensidad al fallo, pocas series (inspirado en Nick Walker, Hadi Choopan): una serie menos, técnicas individuales antes que superseries",
      volumen_tradicional: "volumen tradicional (inspirado en Sam Sulek, Dana Linn Bailey): una serie más, técnicas encadenadas (biserie/superserie) priorizadas",
      hibrido_tension: "híbrido de tensión mecánica (inspirado en CBum, Derek Lunsford, Cydney Gillon): prioridad a máquinas/poleas de alta estabilidad",
      cientifico_rir: "basado en ciencia (inspirado en Jeff Nippard, Francielle Mattos): RIR indicado en cada serie, prioridad a aislados para rango elongado",
    }[brief.inspiracionEstilo];
    reglasAplicadas.push(`Inspiración de estilo: ${nota}`);
  }

  const usaTecnicas = aplicaTecnicas(experiencia, brief);
  if (usaTecnicas && tecnicas.length === 0) alertas.push("No se aplicaron técnicas de intensidad: no hay técnicas activas configuradas en el sistema.");
  if (usaTecnicas && tecnicas.length > 0) {
    const diasConTecnica = Array.from({ length: brief.dias }, (_, i) => i).filter((i) => diaLlevaTecnica(i, brief.dias, brief.intensidadDeseada));
    reglasAplicadas.push(`Técnicas repartidas en la semana: días ${diasConTecnica.map((i) => i + 1).join(", ")} de ${brief.dias} — rotando la técnica para no repetir la misma dos días seguidos`);
    if (brief.tecnicasPermitidas.length > 0) {
      const nombresPermitidos = tecnicas.filter((t) => brief.tecnicasPermitidas.includes(t.slug)).map((t) => t.nombre);
      reglasAplicadas.push(`Técnicas de intensidad limitadas a las elegidas a mano: ${nombresPermitidos.join(", ")}`);
    } else {
      reglasAplicadas.push(
        brief.tecnicasIntensidad === "si"
          ? "Técnicas de intensidad aplicadas en ejercicios accesorios (elegido a mano)"
          : `Técnicas de intensidad predeterminadas para nivel ${experiencia} (biserie/superserie desde intermedio; drop-set/rest-pause según nivelMinimo de cada técnica)`
      );
    }
  }

  const usados = new Set<string>();
  const gruposEntrenadosEnSemana = new Set<GrupoEntrenable>();
  const dias = Array.from({ length: brief.dias }, (_, indice) => {
    const cupos = cuposDelDia(brief, perfil, distribucion, indice);
    if (distribucion === "personalizada" && cupos.length === 0) {
      alertas.push(`El día ${indice + 1} no tiene ningún grupo muscular asignado; quedó sin ejercicios de fuerza (solo el cardio, si corresponde). Asígnale un grupo en "Personalizada".`);
    }
    cupos.forEach((c) => gruposEntrenadosEnSemana.add(c.grupo));
    const cantidadDia = ejerciciosObjetivoDelDia(brief.ejerciciosPorSesion, cupos.length);
    const elegidos = elegirPorCupos(candidatos, cupos, cantidadDia, brief, perfil, usados);

    cupos.forEach((c) => {
      const delGrupo = elegidos.filter(
        (e) => e.grupoMuscular === c.grupo && (!c.subGrupoPierna || coincideSubGrupoPierna(e.nombre, c.subGrupoPierna))
      );
      if (delGrupo.length === 0) alertas.push(`No hay ejercicios de ${etiquetaCupo(c)} disponibles para el día ${indice + 1}; revísalo antes de publicar.`);
      // Pedido explícito: "no me puedes dar una rutina de dos ejercicios de
      // grupo muscular, a menos que sea principiante". Solo aplica en días
      // enfocados (pocos grupos objetivo) — en full body/PPL con muchos
      // grupos combinados, 1-2 por grupo es normal y no es esto.
      else if (cupos.length <= 2 && delGrupo.length < 3 && experiencia !== "principiante") {
        alertas.push(`Día ${indice + 1}: solo ${delGrupo.length} ejercicio${delGrupo.length === 1 ? "" : "s"} de ${etiquetaCupo(c)} para nivel ${experiencia} — conviene al menos 3. Sube "ejercicios por sesión" o revisa cuántos grupos combinás ese día.`);
      }
    });

    const cupoBrazosGeneral = cupos.find((c) => c.grupo === "brazos" && !c.subGrupoBrazo);
    if (cupoBrazosGeneral) {
      const brazos = elegidos.filter((e) => e.grupoMuscular === "brazos");
      const biceps = brazos.filter((e) => subGrupoBrazo(e.nombre) === "biceps").length;
      const triceps = brazos.filter((e) => subGrupoBrazo(e.nombre) === "triceps").length;
      const minimoPorSubgrupo = brazos.length >= 4 ? 2 : 1;
      if (brazos.length >= 2 && (biceps < minimoPorSubgrupo || triceps < minimoPorSubgrupo)) {
        alertas.push(`Día ${indice + 1}: el bloque de brazos quedó desbalanceado (${biceps} de bíceps y ${triceps} de tríceps). Revisa el catálogo o aumenta los espacios del grupo.`);
      }
    }

    // Orden dentro del día: el grupo prioritario va primero (rango más
    // negativo, antes que cualquier otra cosa — "entrenar el rezagado
    // primero, con el cuerpo fresco"); si no hay prioritario, de músculo más
    // grande a más chico ("si trabajás pecho, hombro y tríceps, andá de
    // grande a chico"); dentro del mismo grupo, por posicionSesion.
    const rangoOrden = (e: EjercicioGenerador) => {
      if (brief.grupoPrioritario && e.grupoMuscular === brief.grupoPrioritario) return -1000;
      const tamano = e.grupoMuscular === "cardio" ? 0 : (TAMANO_GRUPO[e.grupoMuscular] ?? 0);
      const posicion = ORDEN_POSICION[e.posicionSesion ?? "accesorio"] ?? 2;
      return (5 - tamano) * 10 + posicion;
    };
    const ordenados = [...elegidos].sort((a, b) => rangoOrden(a) - rangoOrden(b));

    const ejercicios: EjercicioBorrador[] = ordenados.map((e, i) => {
      usados.add(e.id);
      return {
        orden: i + 1,
        ejercicioId: e.id,
        nombre: e.nombre,
        ...prescripcion(brief, perfil, e),
        tecnicaTipo: null,
        tecnicaInstruccion: null,
        observacion: indicacionTecnica(e.nombre, e.grupoMuscular),
        grupoMuscular: e.grupoMuscular,
      };
    });

    if (brief.abdominales) {
      const core = candidatos.find((e) => e.grupoMuscular === "core" && !ejercicios.some((x) => x.ejercicioId === e.id));
      if (core) ejercicios.push({ orden: ejercicios.length + 1, ejercicioId: core.id, nombre: core.nombre, ...prescripcion(brief, perfil, core), tecnicaTipo: null, tecnicaInstruccion: null, observacion: "Trabajo de core al finalizar la fuerza.", grupoMuscular: core.grupoMuscular });
    }

    if (usaTecnicas && tecnicas.length > 0 && diaLlevaTecnica(indice, brief.dias, brief.intensidadDeseada)) {
      aplicarTecnicasDelDia(ejercicios, tecnicas, experiencia, brief, semanaTecnicas);
    }

    for (const cardio of elegirCardio(brief, cardioDisponible, indice)) {
      ejercicios.push({
        orden: ejercicios.length + 1,
        ejercicioId: cardio.ejercicio.id,
        nombre: cardio.ejercicio.nombre,
        series: cardio.series,
        reps: cardio.reps,
        descansoSegundos: cardio.descansoSegundos,
        tecnicaTipo: null,
        tecnicaInstruccion: null,
        observacion: cardio.observacion,
        grupoMuscular: "cardio",
      });
    }

    const nombreDia = (distribucion === "personalizada" || distribucion === "vip_balanceada") && cupos.length > 0
      ? cupos.map(etiquetaCupo).join(" + ")
      : (NOMBRES_DIA[distribucion]?.[indice] ?? `Día ${indice + 1}`);

    return {
      numero: indice + 1,
      nombre: nombreDia,
      tipo: "entrenamiento" as const,
      descripcion: activacionDelDia(cupos, perfil),
      ejercicios,
    };
  });

  for (const id of brief.obligatorios) {
    if (!dias.some((d) => d.ejercicios.some((e) => e.ejercicioId === id))) alertas.push("Un ejercicio obligatorio no fue compatible con la distribución o filtros y debe revisarse.");
  }
  if (distribucion === "personalizada" && brief.diaGrupos && brief.diaGrupos.length < brief.dias) {
    alertas.push("Faltan grupos musculares asignados a algunos días; se usó un valor por defecto.");
  }

  const validacionSemanal = validarSemanaVip(
    { nombreRutina: "Borrador", dias, reglasAplicadas: [], alertas: [] },
    brief,
    perfil
  );
  alertas.push(...validacionSemanal.alertas);
  reglasAplicadas.push(validacionSemanal.reglaResumen);

  // Resumen de por qué esta rutina no es intercambiable con la de otra
  // persona, aunque comparta nivel u objetivo — pedido explícito: "no puede
  // ser una rutina de una persona avanzada igual a otra avanzada si sus
  // objetivos son distintos".
  reglasAplicadas.push(
    `Combinación única de esta rutina: objetivo ${brief.objetivo.replaceAll("_", " ")} · prioridad ${brief.prioridad} · nivel ${experiencia} · estilo ${brief.estiloEntrenamiento.replaceAll("_", " ")} · intensidad ${brief.intensidadDeseada}${brief.inspiracionEstilo !== "ninguna" ? ` · inspiración ${brief.inspiracionEstilo.replaceAll("_", " ")}` : ""}${categoriaCompetencia !== "ninguna" ? ` · referencia ${categoriaCompetencia.replaceAll("_", " ")}` : ""}`
  );

  // Título con nivel y enfoque, no solo el objetivo — pedido explícito:
  // "plan de hipertrofia, avanzado o principiante, es el título; enfoque
  // tren inferior o enfoque X, es el arreglo".
  let nombreRutina = `Plan ${brief.objetivo.replaceAll("_", " ")} ${experiencia}`;
  if (brief.grupoPrioritario) nombreRutina += ` — enfoque ${NOMBRE_GRUPO[brief.grupoPrioritario].toLowerCase()}`;

  return { nombreRutina, dias, reglasAplicadas, alertas };
}
