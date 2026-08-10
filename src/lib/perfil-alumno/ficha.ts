/** La ficha del alumno: lo que la app, el gimnasio y el generador necesitan
 * saber de una persona para armarle un plan pensado y no genérico.
 *
 * Vive acá, fuera de las Server Actions y sin `server-only`, porque la usan
 * tres lugares a la vez y todos tienen que estar de acuerdo en qué campos
 * existen y cuándo la ficha está completa:
 *   - el cuestionario obligatorio de ingreso (`/completar-perfil`),
 *   - "Mi entrenamiento", donde el alumno la corrige después,
 *   - el panel del entrenador, que puede llenarla o corregirla por él.
 *
 * Los datos viven repartidos en dos tablas por historia: `alumno_perfil`
 * (identidad: nacimiento, sexo, estatura, teléfono) y
 * `perfiles_entrenamiento` (objetivo, disponibilidad, salud). Este módulo los
 * trata como una sola cosa, que es como los vive el alumno. */

import type { CategoriaCompetencia } from "@/lib/generador-rutinas/tipos";

export type FichaAlumno = {
  // alumno_perfil
  fechaNacimiento: string | null;
  sexo: string | null;
  estaturaCm: number | null;
  telefono: string | null;
  // perfiles_entrenamiento
  objetivoPrincipal: string | null;
  objetivoSecundario: string | null;
  /** Referencia visual elegida en lenguaje sencillo. El entrenador puede
   * corregirla antes de generar y siempre conserva la decisión final. */
  categoriaReferencia: CategoriaCompetencia | null;
  diasDisponibles: number | null;
  minutosSesion: number | null;
  experiencia: string | null;
  cardioNivel: string | null;
  preferenciaEquipo: string | null;
  actividadesAdicionales: string | null;
  ejerciciosPreferidos: string | null;
  ejerciciosNoDeseados: string | null;
  molestias: string | null;
  lesionesDiagnosticadas: string | null;
  operacionesPrevias: string | null;
  condicionesMedicas: string | null;
  medicamentosRelevantes: string | null;
  autorizacionMedica: boolean;
  completadoEn: string | null;
};

export const FICHA_VACIA: FichaAlumno = {
  fechaNacimiento: null,
  sexo: null,
  estaturaCm: null,
  telefono: null,
  objetivoPrincipal: null,
  objetivoSecundario: null,
  categoriaReferencia: null,
  diasDisponibles: null,
  minutosSesion: null,
  experiencia: null,
  cardioNivel: null,
  preferenciaEquipo: null,
  actividadesAdicionales: null,
  ejerciciosPreferidos: null,
  ejerciciosNoDeseados: null,
  molestias: null,
  lesionesDiagnosticadas: null,
  operacionesPrevias: null,
  condicionesMedicas: null,
  medicamentosRelevantes: null,
  autorizacionMedica: false,
  completadoEn: null,
};

/** Los cinco temas de salud se preguntan con un sí/no explícito y el detalle
 * solo si contestó que sí.
 *
 * Un cuadro de texto vacío no distingue "no tengo nada" de "no lo contesté", y
 * esa diferencia es justamente la que necesita el entrenador —y el filtro de
 * IA— para saber si puede confiar en el silencio. Con el sí/no obligatorio,
 * una ficha marcada como completa y sin molestias significa que la persona
 * dijo que no tiene, no que dejó el campo en blanco. */
export const TEMAS_SALUD = [
  {
    campo: "molestias",
    pregunta: "¿Tienes algún dolor o molestia en este momento?",
    detalle: "¿Dónde y desde cuándo? ¿Con qué movimiento aparece?",
    ejemplo: "Ej: rodilla derecha al bajar escaleras, hace 2 meses",
  },
  {
    campo: "lesiones_diagnosticadas",
    pregunta: "¿Tienes alguna lesión diagnosticada por un profesional?",
    detalle: "¿Cuál y cuándo te la diagnosticaron?",
    ejemplo: "Ej: hernia lumbar L4-L5 diagnosticada el 2023",
  },
  {
    campo: "operaciones_previas",
    pregunta: "¿Te han operado de algo que afecte el entrenamiento?",
    detalle: "¿De qué y hace cuánto? ¿Ya tienes el alta?",
    ejemplo: "Ej: manguito rotador del hombro izquierdo, hace 8 meses, con alta",
  },
  {
    campo: "condiciones_medicas",
    pregunta: "¿Tienes alguna condición médica que debamos considerar?",
    detalle: "¿Cuál?",
    ejemplo: "Ej: diabetes tipo 2, hipertensión, asma",
  },
  {
    campo: "medicamentos_relevantes",
    pregunta: "¿Tomas algún medicamento que pueda afectar tu entrenamiento?",
    detalle: "¿Cuál y para qué?",
    ejemplo: "Ej: betabloqueantes para la presión",
  },
] as const;

export type CampoSalud = (typeof TEMAS_SALUD)[number]["campo"];

/** El sufijo del sí/no que acompaña a cada campo de salud en el formulario. */
export const sufijoTiene = (campo: string) => `${campo}_tiene`;

export const OBJETIVOS = [
  { value: "hipertrofia", label: "Ganar masa muscular" },
  { value: "perdida_grasa", label: "Bajar grasa" },
  { value: "recomposicion", label: "Recomposición (bajar grasa y ganar músculo)" },
  { value: "fuerza", label: "Ganar fuerza" },
  { value: "condicion_fisica", label: "Mejorar mi condición física" },
  { value: "rendimiento", label: "Rendimiento deportivo" },
  { value: "mantencion", label: "Mantenerme" },
] as const;

export const EXPERIENCIAS = [
  { value: "principiante", label: "Principiante — llevo menos de 6 meses entrenando" },
  { value: "intermedio", label: "Intermedio — entreno hace 6 meses a 2 años" },
  { value: "avanzado", label: "Avanzado — entreno hace más de 2 años, sin parar" },
] as const;

export const NIVELES_CARDIO = [
  { value: "bajo", label: "Bajo — me canso rápido" },
  { value: "medio", label: "Medio — aguanto sin problema una caminata exigente" },
  { value: "alto", label: "Alto — hago cardio seguido y lo tolero bien" },
] as const;

export const PREFERENCIAS_EQUIPO = [
  { value: "indistinto", label: "Me da lo mismo" },
  { value: "maquinas", label: "Prefiero máquinas" },
  { value: "peso_libre", label: "Prefiero peso libre" },
] as const;

export const SEXOS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "otro", label: "Prefiero no decirlo" },
] as const;

/** La persona elige por la descripción, sin necesitar conocer el nombre de
 * una categoría de culturismo. En modo entrenador se muestran ambos nombres. */
export const REFERENCIAS_FISICAS: ReadonlyArray<{
  value: CategoriaCompetencia;
  descripcion: string;
  tecnica: string;
}> = [
  {
    value: "ninguna",
    descripcion: "No estoy seguro/a; prefiero que me oriente mi entrenador",
    tecnica: "Sin categoría",
  },
  {
    value: "bikini",
    descripcion: "Cuerpo atlético, proporcionado y definido, sin buscar demasiado volumen",
    tecnica: "Bikini",
  },
  {
    value: "wellness",
    descripcion: "Piernas y glúteos protagonistas, con el tren superior equilibrado",
    tecnica: "Wellness",
  },
  {
    value: "mens_physique",
    descripcion: "Espalda y hombros más anchos, con pecho y brazos marcados",
    tecnica: "Men's Physique",
  },
  {
    value: "classic_physique",
    descripcion: "Musculatura estética, simétrica y equilibrada en todo el cuerpo",
    tecnica: "Classic Physique",
  },
  {
    value: "bodybuilding_open",
    descripcion: "Máximo desarrollo muscular posible en todo el cuerpo",
    tecnica: "Bodybuilding Open",
  },
  {
    value: "womens_physique",
    descripcion: "Musculatura fuerte, definida y equilibrada en todo el cuerpo",
    tecnica: "Women's Physique",
  },
];

export function etiquetaReferenciaFisica(
  categoria: CategoriaCompetencia | null | undefined,
  incluirTecnica = false
): string | null {
  const opcion = REFERENCIAS_FISICAS.find((item) => item.value === categoria);
  if (!opcion) return null;
  return incluirTecnica ? `${opcion.descripcion} — ${opcion.tecnica}` : opcion.descripcion;
}

/** Qué falta para que la ficha se considere contestada.
 *
 * Solo se exige lo que cambia de verdad la rutina que sale del generador: sin
 * fecha de nacimiento no hay ajuste por edad; sexo es parte de la ficha, pero
 * no se usa para suponer objetivos. Sin objetivo/días/minutos/experiencia el
 * motor arma a ciegas. El resto (estatura,
 * preferencias, detalles) suma pero no bloquea. */
export function camposFaltantes(ficha: FichaAlumno): string[] {
  const faltan: string[] = [];
  if (!ficha.fechaNacimiento) faltan.push("fecha de nacimiento");
  if (!ficha.sexo) faltan.push("sexo");
  if (!ficha.objetivoPrincipal) faltan.push("objetivo");
  if (!ficha.diasDisponibles) faltan.push("días por semana");
  if (!ficha.minutosSesion) faltan.push("minutos por sesión");
  if (!ficha.experiencia) faltan.push("experiencia");
  if (!ficha.completadoEn) faltan.push("confirmación de los datos de salud");
  return faltan;
}

export function fichaCompleta(ficha: FichaAlumno): boolean {
  return camposFaltantes(ficha).length === 0;
}
