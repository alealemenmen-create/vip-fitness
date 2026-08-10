import type {
  AplicacionTecnicas,
  CardioModalidad,
  CategoriaCompetencia,
  IntensidadDeseada,
  ObjetivoEntrenamiento,
  PrioridadBloque,
} from "./tipos";

export type FichaParaSugerencias = {
  nombre: string;
  objetivoPrincipal: string | null;
  experiencia: string | null;
  cardioNivel: string | null;
  preferenciaEquipo: string | null;
  categoriaReferencia: CategoriaCompetencia | null;
  dias: number | null;
  minutos: number | null;
  molestias: string | null;
  lesiones: string | null;
  operaciones: string | null;
  condiciones: string | null;
  noDeseados: string | null;
  preferidos: string | null;
};

export type EjercicioParaSugerencias = { id: string; nombre: string; grupo: string; equipo: string };

export type SugerenciasPerfil = {
  objetivo: ObjetivoEntrenamiento | null;
  prioridad: PrioridadBloque | null;
  categoriaCompetencia: CategoriaCompetencia | null;
  dias: number | null;
  minutos: number | null;
  intensidad: IntensidadDeseada;
  tecnicasIntensidad: AplicacionTecnicas;
  cardio: CardioModalidad;
  cardioMinutos: number;
  preferidos: string[];
  prohibidos: string[];
  alertas: string[];
  razones: string[];
};

const OBJETIVOS = new Set<ObjetivoEntrenamiento>([
  "perdida_grasa", "hipertrofia", "fuerza", "recomposicion",
  "condicion_fisica", "rendimiento", "mantencion",
]);
const NIVEL = { principiante: 0, intermedio: 1, avanzado: 2 } as const;

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function objetivoValido(valor: string | null): ObjetivoEntrenamiento | null {
  return valor && OBJETIVOS.has(valor as ObjetivoEntrenamiento) ? valor as ObjetivoEntrenamiento : null;
}

function prioridadPorObjetivo(objetivo: ObjetivoEntrenamiento | null): PrioridadBloque | null {
  if (!objetivo) return null;
  if (objetivo === "fuerza" || objetivo === "rendimiento") return "fuerza";
  if (objetivo === "condicion_fisica") return "cardio";
  if (objetivo === "mantencion") return "adherencia";
  return "hipertrofia";
}

function menorExperiencia(fichas: FichaParaSugerencias[]): keyof typeof NIVEL | null {
  const presentes = fichas.map((f) => f.experiencia).filter((v): v is keyof typeof NIVEL => Boolean(v && v in NIVEL));
  return presentes.length ? presentes.sort((a, b) => NIVEL[a] - NIVEL[b])[0] : null;
}

function idsMencionados(textos: Array<string | null>, ejercicios: EjercicioParaSugerencias[]): string[] {
  const fragmentos = textos
    .filter((t): t is string => Boolean(t?.trim()))
    .flatMap((t) => normalizar(t).split(/\b(?:y|pero|excepto|nada de|no quiero)\b|[,;/\n]/).map((x) => x.trim()).filter((x) => x.length >= 4));
  if (!fragmentos.length) return [];
  return ejercicios
    .filter((e) => {
      const nombre = normalizar(e.nombre);
      return fragmentos.some((f) => nombre === f || nombre.includes(f) || (nombre.length >= 5 && f.includes(nombre)));
    })
    .map((e) => e.id);
}

/** Traduce respuestas de una o varias fichas a un punto de partida editable.
 * Solo automatiza decisiones con una relación suficientemente clara. Lo
 * ambiguo se informa como alerta para que Alejandro lo resuelva. */
export function sugerirDesdeFichas(
  fichas: FichaParaSugerencias[],
  ejercicios: EjercicioParaSugerencias[],
  cardioDisponible: CardioModalidad[]
): SugerenciasPerfil {
  if (!fichas.length) throw new Error("Selecciona al menos un alumno para aplicar sugerencias.");
  const alertas: string[] = [];
  const razones: string[] = [];
  const objetivos = fichas.map((f) => objetivoValido(f.objetivoPrincipal)).filter((v): v is ObjetivoEntrenamiento => v !== null);
  const objetivo = objetivos.length > 0 && objetivos.every((v) => v === objetivos[0]) ? objetivos[0] : null;
  if (new Set(objetivos).size > 1) alertas.push("Los alumnos declararon objetivos diferentes; elige manualmente el objetivo común de esta rutina.");
  if (objetivo) razones.push(`Objetivo ${objetivo.replaceAll("_", " ")} tomado de la ficha`);

  const categorias = fichas
    .map((f) => f.categoriaReferencia)
    .filter((v): v is CategoriaCompetencia => Boolean(v && v !== "ninguna"));
  const categoriaCompetencia = categorias.length > 0 && categorias.every((v) => v === categorias[0])
    ? categorias[0]
    : categorias.length === 0 ? "ninguna" : null;
  if (new Set(categorias).size > 1) {
    alertas.push("Los alumnos eligieron referencias físicas diferentes; el entrenador debe definir el enfoque común de la rutina grupal.");
  }
  if (categoriaCompetencia && categoriaCompetencia !== "ninguna") {
    razones.push(`Referencia física ${categoriaCompetencia.replaceAll("_", " ")} tomada de la ficha; queda sujeta a la decisión del entrenador`);
  }

  const diasPresentes = fichas.map((f) => f.dias).filter((v): v is number => Boolean(v));
  const minutosPresentes = fichas.map((f) => f.minutos).filter((v): v is number => Boolean(v));
  const dias = diasPresentes.length ? Math.min(...diasPresentes) : null;
  const minutos = minutosPresentes.length ? Math.min(...minutosPresentes) : null;
  if (new Set(diasPresentes).size > 1) alertas.push(`El grupo declaró disponibilidades distintas; se sugieren ${dias} días, el máximo compatible con todos.`);
  if (new Set(minutosPresentes).size > 1) alertas.push(`El grupo declaró duraciones distintas; se sugieren ${minutos} minutos, el tiempo compatible con todos.`);

  const experiencia = menorExperiencia(fichas);
  const intensidad: IntensidadDeseada = experiencia === "avanzado" ? "alta" : "estandar";
  const tecnicasIntensidad: AplicacionTecnicas = experiencia === "principiante" ? "automatico" : "si";
  if (experiencia) razones.push(`Intensidad calibrada para nivel ${experiencia}`);

  const requiereCardio = objetivo === "perdida_grasa" || objetivo === "condicion_fisica" || objetivo === "rendimiento";
  const modalidad = cardioDisponible.find((c) => c !== "ninguno" && c !== "indistinto") ?? cardioDisponible[0] ?? "ninguno";
  const cardio = requiereCardio ? modalidad : "ninguno";
  const nivelCardioMasBajo = fichas.some((f) => f.cardioNivel === "bajo") ? "bajo" : fichas.some((f) => f.cardioNivel === "medio") ? "medio" : "alto";
  const cardioMinutos = nivelCardioMasBajo === "bajo" ? 10 : nivelCardioMasBajo === "medio" ? 15 : 20;
  if (requiereCardio && cardio === "ninguno") alertas.push("El objetivo sugiere cardio, pero no existe una modalidad activa en la biblioteca.");

  const prohibidos = idsMencionados(fichas.map((f) => f.noDeseados), ejercicios);
  const preferidos = idsMencionados(fichas.map((f) => f.preferidos), ejercicios).filter((id) => !prohibidos.includes(id));
  if (prohibidos.length) razones.push(`${prohibidos.length} ejercicio${prohibidos.length === 1 ? "" : "s"} no deseado${prohibidos.length === 1 ? "" : "s"} identificado${prohibidos.length === 1 ? "" : "s"}`);
  if (preferidos.length) razones.push(`${preferidos.length} ejercicio${preferidos.length === 1 ? "" : "s"} preferido${preferidos.length === 1 ? "" : "s"} identificado${preferidos.length === 1 ? "" : "s"}`);

  const textosNoDeseados = fichas.filter((f) => f.noDeseados?.trim()).length;
  const textosPreferidos = fichas.filter((f) => f.preferidos?.trim()).length;
  if (textosNoDeseados && !prohibidos.length) alertas.push("Hay ejercicios no deseados escritos en texto, pero no coincidieron de forma segura con la biblioteca. Revísalos manualmente.");
  if (textosPreferidos && !preferidos.length) alertas.push("Hay ejercicios preferidos escritos en texto, pero no coincidieron de forma segura con la biblioteca.");

  const antecedentes = fichas.filter((f) => [f.molestias, f.lesiones, f.operaciones, f.condiciones].some((v) => Boolean(v?.trim())));
  if (antecedentes.length) alertas.push(`${antecedentes.length} alumno${antecedentes.length === 1 ? " tiene" : "s tienen"} antecedentes que el entrenador debe revisar; no se dedujeron restricciones médicas automáticamente.`);

  return {
    objetivo,
    prioridad: prioridadPorObjetivo(objetivo),
    categoriaCompetencia,
    dias,
    minutos,
    intensidad,
    tecnicasIntensidad,
    cardio,
    cardioMinutos,
    preferidos,
    prohibidos,
    alertas,
    razones,
  };
}
