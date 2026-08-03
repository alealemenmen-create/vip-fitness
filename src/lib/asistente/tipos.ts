export type TipoReporteVip = "atencion" | "nutricion" | "entrenamiento" | "progreso";

export type EstadoReporteVip = "atencion" | "bien" | "sin_datos" | "informativo";

export type MetricaReporteVip = {
  etiqueta: string;
  valor: string;
};

export type AlumnoReporteVip = {
  alumnoId: string;
  nombre: string;
  objetivo: string | null;
  estado: EstadoReporteVip;
  motivo: string;
  metricas: MetricaReporteVip[];
};

export type ResultadoReporteVip = {
  tipo: TipoReporteVip;
  titulo: string;
  descripcion: string;
  periodo: string;
  totalEvaluados: number;
  totalCoincidencias: number;
  limitado: boolean;
  alumnos: AlumnoReporteVip[];
  generadoConIA: false;
};

export type BorradorNoticiaVip = {
  id: string | null;
  titulo: string;
  mensaje: string;
};

export type CategoriaEliminacion = "entrenamiento" | "comida" | "progreso" | "ranking";

export const ETIQUETA_CATEGORIA_ELIMINACION: Record<CategoriaEliminacion, string> = {
  entrenamiento: "Entrenamiento",
  comida: "Comida",
  progreso: "Progreso",
  ranking: "Ranking / Puntos VIP",
};

export type ConteoTabla = { tabla: string; etiqueta: string; cantidad: number };

/** La IA nunca borra nada: arma esta propuesta (fila `pendiente` en
 * `solicitudes_eliminacion_datos`) y el entrenador confirma aparte, con un
 * botón explícito. Ver `lib/asistente/eliminacion.ts`. */
export type SolicitudEliminacionVip = {
  id: string;
  alumnoId: string;
  alumnoNombre: string;
  categoria: CategoriaEliminacion;
  resumen: ConteoTabla[];
};

export type RespuestaIaVip = {
  titulo: string;
  resumen: string;
  herramienta: TipoReporteVip | "noticia" | "eliminar_datos";
  usoIA: boolean;
  costoUsd: number;
  aviso: string;
  borradorNoticia: BorradorNoticiaVip | null;
  solicitudEliminacion: SolicitudEliminacionVip | null;
};
