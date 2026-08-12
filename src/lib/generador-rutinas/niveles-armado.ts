import type { BriefGenerador } from "./tipos";

/** Punto de partida para la herramienta de armado manual.
 *
 * El generador completo tiene 91 campos y 7 gavetas: es la cocina entera. Esto
 * es lo contrario — el entrenador elige alumno y nivel, el motor le devuelve
 * una base decente, y de ahí en adelante arma él a mano sobre la vista previa.
 * Pedido explícito: "que yo pueda, como entrenador, hacer la rutina yo mismo…
 * tendría menos margen de error, pero ya con una herramienta".
 *
 * No es un motor nuevo: cada nivel es un `BriefGenerador` preconfigurado que
 * se le pasa al mismo `generarRutinaPorReglas` de siempre. Todo lo que el
 * motor ya garantiza (cupos por grupo, biblioteca real, topes de volumen
 * semanal, filtros de nivel y de impacto) sigue valiendo igual. */
export type NivelArmado =
  | "principiante"
  | "intermedio"
  | "avanzado"
  | "olympia"
  // Compatibilidad con borradores y pruebas anteriores. Ya no se ofrecen al
  // elegir nivel (ver `NIVELES` en ArmarRutinaPanel), pero un borrador guardado
  // con uno de estos tiene que seguir abriendo sin romperse.
  | "profesional"
  | "competitivo"
  | "estandar"
  | "senior";

/** Campos que decide el nivel. El resto del brief lo completa
 * `briefDesdeNivel` con lo que viene del alumno (días, minutos, alumnoId). */
type PresetNivel = {
  etiqueta: string;
  descripcion: string;
  brief: Pick<
    BriefGenerador,
    | "objetivo"
    | "prioridad"
    | "intensidadDeseada"
    | "tecnicasIntensidad"
    | "estiloEntrenamiento"
    | "inspiracionEstilo"
    | "ejerciciosPorSesion"
    | "evitarSaltos"
    | "abdominales"
    | "cardio"
    | "cardioMinutos"
  >;
};

export const NIVELES_ARMADO: Record<NivelArmado, PresetNivel> = {
  // Los cuatro niveles vivos. Las cantidades las fijó Alejandro el 11/08/2026
  // y son POR SESIÓN, no por músculo: 5 · 6 · 8-9 · 10 ejercicios. La
  // descripción las dice en voz alta a propósito — antes cada nivel era una
  // frase de estilo ("más densidad", "volumen alto") y no había forma de saber
  // qué iba a salir sin generar la rutina y contarla.
  principiante: {
    etiqueta: "Principiante",
    descripcion: "5 ejercicios por sesión · 2 series cada uno. Técnica primero, sin técnicas de intensidad.",
    brief: {
      objetivo: "hipertrofia", prioridad: "retorno", intensidadDeseada: "estandar", tecnicasIntensidad: "no",
      estiloEntrenamiento: "vieja_escuela", inspiracionEstilo: "ninguna", ejerciciosPorSesion: 5,
      evitarSaltos: true, abdominales: true, cardio: "ninguno", cardioMinutos: 0,
    },
  },
  intermedio: {
    etiqueta: "Intermedio",
    descripcion: "6 ejercicios por sesión · 3 series cada uno. Hipertrofia equilibrada, técnicas solo cuando corresponden.",
    brief: {
      objetivo: "hipertrofia", prioridad: "hipertrofia", intensidadDeseada: "estandar", tecnicasIntensidad: "automatico",
      estiloEntrenamiento: "hibrido", inspiracionEstilo: "ninguna", ejerciciosPorSesion: 6,
      evitarSaltos: false, abdominales: true, cardio: "ninguno", cardioMinutos: 0,
    },
  },
  avanzado: {
    etiqueta: "Avanzado",
    descripcion: "8 ejercicios por sesión · 4 series cada uno. Más densidad y recursos de intensidad controlados.",
    brief: {
      objetivo: "hipertrofia", prioridad: "hipertrofia", intensidadDeseada: "alta", tecnicasIntensidad: "si",
      estiloEntrenamiento: "hibrido", inspiracionEstilo: "alta_intensidad", ejerciciosPorSesion: 8,
      evitarSaltos: false, abdominales: true, cardio: "ninguno", cardioMinutos: 0,
    },
  },
  olympia: {
    etiqueta: "Olympia",
    descripcion: "10 ejercicios por sesión · 4 series cada uno. Preparación competitiva: más variedad y finalizadores.",
    brief: {
      objetivo: "hipertrofia", prioridad: "hipertrofia", intensidadDeseada: "competitiva", tecnicasIntensidad: "si",
      estiloEntrenamiento: "hibrido", inspiracionEstilo: "volumen_tradicional", ejerciciosPorSesion: 10,
      evitarSaltos: false, abdominales: true, cardio: "ninguno", cardioMinutos: 0,
    },
  },
  profesional: {
    etiqueta: "Profesional",
    descripcion: "Alta exigencia con balance entre tensión, volumen y recuperación del atleta.",
    brief: {
      objetivo: "hipertrofia", prioridad: "fuerza", intensidadDeseada: "competitiva", tecnicasIntensidad: "si",
      estiloEntrenamiento: "hibrido", inspiracionEstilo: "hibrido_tension", ejerciciosPorSesion: 8,
      evitarSaltos: false, abdominales: true, cardio: "ninguno", cardioMinutos: 0,
    },
  },
  competitivo: {
    etiqueta: "Competitivo / Olympia",
    descripcion:
      "Volumen y densidad de preparación: más ejercicios por sesión, series altas y técnicas de intensidad habilitadas.",
    brief: {
      objetivo: "hipertrofia",
      prioridad: "hipertrofia",
      intensidadDeseada: "competitiva",
      tecnicasIntensidad: "si",
      estiloEntrenamiento: "hibrido",
      // Volumen tradicional, no híbrido de tensión: en el motor esta
      // inspiración intenta una SEGUNDA técnica encadenada sobre los
      // accesorios que quedaron sueltos (ver `intentarEncadenada` en
      // motor.ts). Es lo que separa una sesión exigente de una sesión larga:
      // más biseries y triseries reales, no solo más ejercicios sueltos.
      inspiracionEstilo: "volumen_tradicional",
      ejerciciosPorSesion: 8,
      evitarSaltos: false,
      abdominales: true,
      cardio: "ninguno",
      cardioMinutos: 0,
    },
  },
  estandar: {
    etiqueta: "Estándar",
    descripcion: "El alumno habitual del gimnasio: hipertrofia, volumen sensato y técnicas según su nivel.",
    brief: {
      objetivo: "hipertrofia",
      prioridad: "hipertrofia",
      intensidadDeseada: "estandar",
      tecnicasIntensidad: "automatico",
      estiloEntrenamiento: "hibrido",
      inspiracionEstilo: "ninguna",
      ejerciciosPorSesion: 6,
      evitarSaltos: false,
      abdominales: true,
      cardio: "ninguno",
      cardioMinutos: 0,
    },
  },
  senior: {
    etiqueta: "Senior / recuperación",
    descripcion:
      "Prioriza recuperar y sostener: menos ejercicios, sin técnicas al fallo, sin saltos ni impacto alto.",
    brief: {
      objetivo: "condicion_fisica",
      // "retorno" baja las reps a 10-12 y sube los descansos en el motor.
      prioridad: "retorno",
      intensidadDeseada: "estandar",
      // Nunca automático acá: el motor habilita técnicas desde intermedio, y
      // en este nivel no las queremos aunque el alumno tenga experiencia.
      tecnicasIntensidad: "no",
      estiloEntrenamiento: "hibrido",
      inspiracionEstilo: "ninguna",
      ejerciciosPorSesion: 5,
      evitarSaltos: true,
      abdominales: true,
      cardio: "ninguno",
      cardioMinutos: 0,
    },
  },
};

/** Arma el brief completo para el motor: el nivel pone el criterio de
 * entrenamiento, el alumno pone su realidad (días que paga, minutos de los que
 * dispone). Todo lo demás queda neutro a propósito — la idea es que el
 * entrenador ajuste sobre la rutina ya armada, no antes de armarla. */
export function briefDesdeNivel(
  nivel: NivelArmado,
  datos: { alumnoId: string; alumnoIds?: string[]; dias: number; minutosSesion: number }
): BriefGenerador {
  return {
    ...NIVELES_ARMADO[nivel].brief,
    alumnoId: datos.alumnoId,
    alumnoIds: datos.alumnoIds,
    dias: datos.dias,
    minutosSesion: datos.minutosSesion,
    // Automática: el motor elige el reparto según los días. El entrenador
    // reordena después moviendo ejercicios en la vista previa, que es
    // justamente el punto de esta herramienta.
    distribucion: "automatica",
    diaGrupos: null,
    grupoPrioritario: null,
    enfoqueForma: "ninguno",
    limitesPorGrupo: null,
    cardioEjercicios: [],
    cardioFormato: "circuito",
    obligatorios: [],
    prohibidos: [],
    preferidos: [],
    tecnicaNombre: null,
    ayudasErgogenicas: "prefiere_no_decir",
    categoriaCompetencia: "ninguna",
    tecnicasPermitidas: [],
    observaciones: "",
  };
}
