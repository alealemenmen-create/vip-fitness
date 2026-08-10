export type PeriodoSeguimiento = 7 | 14 | 30;
export type NivelCumplimiento = "excelente" | "muy_bien" | "en_proceso" | "atencion" | "sin_datos";
export type PrioridadAlerta = "alta" | "media" | "positiva";

export type AlertaSeguimiento = {
  prioridad: PrioridadAlerta;
  titulo: string;
  detalle: string;
};

export type SesionDiaSeguimiento = {
  id: string;
  nombre: string;
  estado: string;
  ejerciciosCompletados: number;
  ejerciciosTotales: number;
  seriesRealizadas: number;
  seriesTotales: number;
  cardioCompletado: boolean;
  dificultad: string | null;
};

export type NutricionDiaSeguimiento = {
  comidas: number;
  omitidas: number;
  kcal: number;
  proteina: number;
  carbohidratos: number;
  grasa: number;
  kcalPct: number | null;
  proteinaPct: number | null;
};

export type DiaSeguimiento = {
  fecha: string;
  sesiones: SesionDiaSeguimiento[];
  nutricion: NutricionDiaSeguimiento | null;
  aguaLitros: number | null;
  suenoHoras: number | null;
  energia: number | null;
  molestias: string | null;
  comentario: string | null;
  declaracionEntreno: boolean | null;
  declaracionAlimentacion: boolean | null;
  pesoKg: number | null;
};

export type ResumenSeguimiento = {
  adherenciaGeneral: number | null;
  nivel: NivelCumplimiento;
  entrenamientoPct: number | null;
  sesionesRealizadas: number;
  sesionesEsperadas: number;
  calidadSesionesPct: number | null;
  nutricionPct: number | null;
  diasConAlimentacion: number;
  diasPeriodo: number;
  kcalPromedio: number | null;
  kcalObjetivo: number | null;
  proteinaPromedio: number | null;
  proteinaObjetivo: number | null;
  recuperacionPct: number;
  aguaPromedio: number | null;
  suenoPromedio: number | null;
  energiaPromedio: number | null;
  progresionesCumplidas: number;
  progresionesEvaluadas: number;
};

export type EvolucionSeguimiento = {
  pesoInicial: number | null;
  pesoActual: number | null;
  variacionPeso: number | null;
  pesosRegistrados: number;
  fotosPeriodo: number;
  ultimaFoto: string | null;
  medidasPeriodo: number;
  ultimaMedida: string | null;
};

export type RevisionSeguimiento = {
  id: string;
  desde: string;
  hasta: string;
  observacion: string;
  decisionSiguientePlan: string | null;
  creadoEn: string;
  entrenadorNombre: string;
};

export type SeguimientoIntegral = {
  alumnoId: string;
  alumnoNombre: string;
  diasPeriodo: PeriodoSeguimiento;
  desde: string;
  hasta: string;
  resumen: ResumenSeguimiento;
  evolucion: EvolucionSeguimiento;
  alertas: AlertaSeguimiento[];
  dias: DiaSeguimiento[];
  revisiones: RevisionSeguimiento[];
};
