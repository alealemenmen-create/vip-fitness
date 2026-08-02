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

