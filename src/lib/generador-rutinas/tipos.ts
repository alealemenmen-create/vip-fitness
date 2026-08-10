import type { CategoriaEjercicio, EquipoEjercicio, NivelEjercicio } from "@/lib/ejercicios/tipos";
import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

export type ObjetivoEntrenamiento =
  | "perdida_grasa"
  | "hipertrofia"
  | "fuerza"
  | "recomposicion"
  | "condicion_fisica"
  | "rendimiento"
  | "mantencion";

/** "personalizada": el entrenador elige a mano qué grupo(s) — sin tope, como
 * en sus rutinas reales ("Espalda + Hombros + Brazos + Abdomen" en un mismo
 * día) — entrena cada día. Reemplaza al viejo "bro_split" (que topaba en 2
 * grupos); ver GeneradorRutinasPanel. */
export type Distribucion = "automatica" | "vip_balanceada" | "full_body" | "upper_lower" | "push_pull_legs" | "personalizada";
export type PrioridadBloque = "fuerza" | "hipertrofia" | "cardio" | "tecnica" | "retorno" | "adherencia";
export type AplicacionTecnicas = "automatico" | "si" | "no";

/** Grupo muscular entrenable en un día, sin cardio (eso se agrega aparte). */
export type GrupoEntrenable = Exclude<GrupoMuscular, "cardio">;

/** Sub-parte de "piernas" — el entrenador a veces las junta y a veces las
 * separa ("depende el enfoque y la cantidad de días"). No es un
 * `grupoMuscular` real en la base (esa columna solo tiene "piernas"), así
 * que se resuelve por heurística de nombre igual que `EnfoqueForma`. */
export type SubGrupoPierna = "gluteo" | "cuadriceps" | "femoral" | "pantorrilla";
/** Lo que se puede marcar por día en la distribución "personalizada": un
 * grupo entero o, en vez de "piernas", una de sus sub-partes. */
export type EtiquetaDia = GrupoEntrenable | SubGrupoPierna;

/** Arquetipos de programación inspirados en corrientes reales del
 * culturismo actual (HIT/alta intensidad, volumen tradicional, híbrido de
 * tensión mecánica, basado en ciencia/RIR) — no reproduce la rutina exacta
 * de nadie, encodea el ENFOQUE general de cada corriente. */
export type InspiracionEstilo = "ninguna" | "alta_intensidad" | "volumen_tradicional" | "hibrido_tension" | "cientifico_rir";

export type AyudasErgogenicas = "no" | "si" | "prefiere_no_decir";
export type CategoriaCompetencia =
  | "ninguna"
  | "mens_physique"
  | "classic_physique"
  | "bodybuilding_open"
  | "bikini"
  | "wellness"
  | "womens_physique";
/** "vieja_escuela": un grupo (o dos) por día, día a día a elección del
 * entrenador. "nueva_escuela": splits funcionales (PPL/upper-lower) con
 * técnicas de intensidad. "hibrido": splits de nueva escuela pero con el
 * volumen/densidad de la vieja escuela — es el default que pidió el
 * entrenador ("entrenos más tradicionales pero con técnicas de la nueva
 * escuela"). */
export type EstiloEntrenamiento = "nueva_escuela" | "vieja_escuela" | "hibrido";
export type IntensidadDeseada = "estandar" | "alta" | "competitiva";
/** Qué "forma" de ejercicio favorecer dentro de cada grupo muscular:
 * "amplitud" (ancho — jalones, aperturas, elevaciones laterales), "densidad"
 * (grosor — remos, pesos muertos, presses cerrados) o "definicion" (aislados,
 * categoria === "aislamiento", para pump/finalización). No filtra el
 * catálogo, solo lo prioriza — igual que el énfasis por sexo. */
export type EnfoqueForma = "ninguno" | "amplitud" | "densidad" | "definicion";

/** Modalidad real de cardio del gimnasio. Reemplaza al viejo
 * "ninguno/bajo/moderado/alto", que describía una intensidad abstracta y no
 * servía para armar nada: el entrenador elige la máquina o el trabajo
 * funcional concreto, igual que lo haría en la sala. */
export type CardioModalidad = "ninguno" | "spinning" | "caminadora" | "steps" | "funcional" | "indistinto";

/** Cómo se hacen los movimientos funcionales que el entrenador marcó:
 * encadenados como circuito (una estación tras otra, descanso corto) o cada
 * uno como su propio bloque, con su descanso normal. */
export type FormatoCardioFuncional = "circuito" | "separado";

export type PerfilEntrenamiento = {
  alumnoId: string;
  sexo: "femenino" | "masculino" | "otro" | null;
  /** El estilo por defecto del entrenador es exigente (alta densidad,
   * culturismo de élite) — esto es lo que lo atempera con la realidad del
   * cuerpo de cada alumno. null = no se pudo calcular (sin fecha de
   * nacimiento registrada). */
  edad: number | null;
  /** IDs de ejercicios de la última rutina activa de este alumno — para que
   * la próxima no sea calcada y "se sienta" un cambio real. */
  ejerciciosRecientes: string[];
  objetivoPrincipal: ObjetivoEntrenamiento | null;
  objetivoSecundario: string | null;
  diasDisponibles: number | null;
  minutosSesion: number | null;
  experiencia: NivelEjercicio | null;
  cardioNivel: "bajo" | "medio" | "alto" | null;
  preferenciaEquipo: "maquinas" | "peso_libre" | "indistinto" | null;
  ayudasErgogenicas: AyudasErgogenicas | null;
  categoriaCompetencia: CategoriaCompetencia | null;
  estiloEntrenamiento: EstiloEntrenamiento | null;
  intensidadDeseada: IntensidadDeseada | null;
  molestias: string | null;
  lesionesDiagnosticadas: string | null;
  condicionesMedicas: string | null;
  medicamentosRelevantes: string | null;
  /** Texto libre que escribe el propio alumno en `/alumno/mi-entrenamiento`.
   * El motor de reglas no puede interpretarlos (son frases, no columnas), pero
   * son justamente el material que revisa el filtro de IA antes de publicar
   * — ver `src/lib/ai/revisarRutina.ts`. */
  operacionesPrevias: string | null;
  actividadesAdicionales: string | null;
  ejerciciosPreferidos: string | null;
  ejerciciosNoDeseados: string | null;
  requiereRevision: boolean;
};

/** Técnica de intensidad real de `tecnicas_entrenamiento` — antes esta tabla
 * existía en la base de datos pero ningún código la leía. */
export type TecnicaEntrenamiento = {
  id: string;
  nombre: string;
  slug: string;
  tipo: "individual" | "encadenada";
  cantidadEjercicios: number | null;
  nivelMinimo: NivelEjercicio;
  fatiga: "baja" | "media" | "alta";
  requiereSupervision: boolean;
  descansoInternoSeg: number;
  descansoFinalSeg: number;
  maximoPorSesion: number;
};

export type EjercicioGenerador = {
  id: string;
  nombre: string;
  grupoMuscular: GrupoMuscular;
  categoria: CategoriaEjercicio;
  equipo: EquipoEjercicio;
  nivel: NivelEjercicio;
  requiereSalto?: boolean;
  impacto?: "bajo" | "medio" | "alto";
  complejidad?: "baja" | "media" | "alta";
  requiereSupervision?: boolean;
  posicionSesion?: "activacion" | "principal" | "accesorio" | "finalizador" | "cardio";
  etiquetasPrecaucion?: string[];
};

export type BriefGenerador = {
  alumnoId: string;
  /** Una rutina grupal conserva un alumno principal por compatibilidad, pero
   * se genera y audita contra todos los perfiles indicados aquí. */
  alumnoIds?: string[];
  objetivo: ObjetivoEntrenamiento;
  prioridad: PrioridadBloque;
  dias: number;
  minutosSesion: number;
  distribucion: Distribucion;
  /** Solo cuando distribucion === "personalizada": qué grupo(s) entrena cada
   * día, elegidos a mano por el entrenador y sin tope. Índice = día - 1. */
  diaGrupos: EtiquetaDia[][] | null;
  /** Enfoque de programación inspirado en corrientes reales (ver
   * InspiracionEstilo) — ajusta series, técnicas y selección de equipo. */
  inspiracionEstilo: InspiracionEstilo;
  /** Grupo que se entrena primero en los días que aparece — para priorizar
   * un rezagado, como hacen los entrenadores de competencia. */
  grupoPrioritario: GrupoEntrenable | null;
  enfoqueForma: EnfoqueForma;
  /** La dicta el tiempo de sesión (ver `ejerciciosPorTiempo` en motor.ts):
   * "el tiempo que el entrenador elige dicta la cantidad de ejercicio".
   * Se puede corregir a mano, pero arranca calculada. */
  ejerciciosPorSesion: number;
  cardio: CardioModalidad;
  cardioMinutos: number;
  /** Solo para `cardio: "funcional"`: ids de los movimientos funcionales que
   * el entrenador marcó (burpees, cuerda, slam ball…). Vacío = los elige el
   * motor entre los disponibles. */
  cardioEjercicios: string[];
  /** Solo aplica a `cardio: "funcional"`. */
  cardioFormato: FormatoCardioFuncional;
  abdominales: boolean;
  evitarSaltos: boolean;
  obligatorios: string[];
  prohibidos: string[];
  preferidos: string[];
  tecnicaNombre: string | null;
  estiloEntrenamiento: EstiloEntrenamiento;
  ayudasErgogenicas: AyudasErgogenicas;
  categoriaCompetencia: CategoriaCompetencia;
  intensidadDeseada: IntensidadDeseada;
  /** Sobrescribe el criterio automático (avanzado + intensidad alta/erg.)
   * para decidir si se aplican técnicas de intensidad. El filtro por
   * nivelMinimo de cada técnica sigue protegiendo a los principiantes. */
  tecnicasIntensidad: AplicacionTecnicas;
  /** Slugs de `tecnicas_entrenamiento` que el entrenador marcó a mano (ej.
   * ["biserie", "drop-set"]). Vacío = sin restricción, entran todas las que
   * el nivel del alumno permita. No vacío = SOLO estas, aunque el nivel
   * permitiera otras. */
  tecnicasPermitidas: string[];
  observaciones: string;
};

export type EjercicioBorrador = {
  orden: number;
  ejercicioId: string;
  nombre: string;
  series: number;
  reps: string;
  descansoSegundos: number;
  tecnicaTipo: string | null;
  tecnicaInstruccion: string | null;
  observacion: string | null;
  grupoMuscular: GrupoMuscular;
};

export type RutinaGenerada = {
  nombreRutina: string;
  dias: Array<{
    numero: number;
    nombre: string;
    tipo: "entrenamiento";
    descripcion: string | null;
    ejercicios: EjercicioBorrador[];
  }>;
  reglasAplicadas: string[];
  alertas: string[];
};

