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

export type Distribucion = "automatica" | "full_body" | "upper_lower" | "push_pull_legs";
export type PrioridadBloque = "fuerza" | "hipertrofia" | "cardio" | "tecnica" | "retorno" | "adherencia";

export type PerfilEntrenamiento = {
  alumnoId: string;
  objetivoPrincipal: ObjetivoEntrenamiento | null;
  objetivoSecundario: string | null;
  diasDisponibles: number | null;
  minutosSesion: number | null;
  experiencia: NivelEjercicio | null;
  cardioNivel: "bajo" | "medio" | "alto" | null;
  preferenciaEquipo: "maquinas" | "peso_libre" | "indistinto" | null;
  molestias: string | null;
  lesionesDiagnosticadas: string | null;
  condicionesMedicas: string | null;
  medicamentosRelevantes: string | null;
  requiereRevision: boolean;
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
  objetivo: ObjetivoEntrenamiento;
  prioridad: PrioridadBloque;
  dias: number;
  minutosSesion: number;
  distribucion: Distribucion;
  ejerciciosPorSesion: number;
  cardio: "ninguno" | "bajo" | "moderado" | "alto";
  cardioMinutos: number;
  abdominales: boolean;
  soloMaquinas: boolean;
  evitarSaltos: boolean;
  obligatorios: string[];
  prohibidos: string[];
  preferidos: string[];
  tecnicaNombre: string | null;
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

