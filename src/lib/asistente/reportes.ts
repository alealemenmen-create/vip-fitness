import "server-only";

import type { ReporteAlumno } from "@/app/admin/alumnos/data";
import type {
  AlumnoReporteVip,
  EstadoReporteVip,
  ResultadoReporteVip,
  TipoReporteVip,
} from "@/lib/asistente/tipos";

const LIMITE_RESULTADOS = 20;

function numero(valor: number | null, sufijo = ""): string {
  return valor === null ? "Sin registro" : `${valor}${sufijo}`;
}

function estadoNutricion(reporte: ReporteAlumno): EstadoReporteVip {
  if (reporte.kcalObjetivo === null || reporte.kcalPromedio === null) return "sin_datos";
  if (reporte.diasConComida <= 2) return "atencion";
  const proporcion = reporte.kcalPromedio / reporte.kcalObjetivo;
  if (proporcion < 0.75 || proporcion > 1.25) return "atencion";
  return reporte.diasConComida >= 5 ? "bien" : "informativo";
}

function nutricion(reporte: ReporteAlumno): AlumnoReporteVip {
  const estado = estadoNutricion(reporte);
  let motivo = "Registro nutricional parcial esta semana";
  if (reporte.kcalObjetivo === null) motivo = "No tiene una meta calórica activa";
  else if (reporte.kcalPromedio === null) motivo = "No hay alimentos suficientes para calcular calorías";
  else if (reporte.diasConComida <= 2) motivo = `Solo registró comidas ${reporte.diasConComida} de 7 días`;
  else {
    const diferencia = Math.round(((reporte.kcalPromedio - reporte.kcalObjetivo) / reporte.kcalObjetivo) * 100);
    if (Math.abs(diferencia) <= 15) motivo = "Promedio calórico cercano a su objetivo";
    else motivo = `Promedio ${Math.abs(diferencia)}% ${diferencia < 0 ? "bajo" : "sobre"} su objetivo`;
  }

  return {
    alumnoId: reporte.alumnoId,
    nombre: reporte.nombre,
    objetivo: reporte.objetivo,
    estado,
    motivo,
    metricas: [
      { etiqueta: "Días registrados", valor: `${reporte.diasConComida}/7` },
      { etiqueta: "Promedio", valor: numero(reporte.kcalPromedio, " kcal") },
      { etiqueta: "Objetivo", valor: numero(reporte.kcalObjetivo, " kcal") },
    ],
  };
}

function entrenamiento(reporte: ReporteAlumno): AlumnoReporteVip {
  let estado: EstadoReporteVip = "informativo";
  let motivo = `${reporte.pctSesiones}% de las sesiones estimadas del mes`;
  if (reporte.sesionesAsignadas === 0) {
    estado = "sin_datos";
    motivo = "No tiene una rutina activa asignada";
  } else if (reporte.sesionesHechas === 0) {
    estado = "atencion";
    motivo = "Todavía no finalizó entrenamientos este mes";
  } else if (reporte.pctSesiones < 50) {
    estado = "atencion";
    motivo = `Cumplimiento bajo: ${reporte.pctSesiones}% este mes`;
  } else if (reporte.pctSesiones >= 80) {
    estado = "bien";
    motivo = `Buen ritmo: ${reporte.pctSesiones}% este mes`;
  }

  return {
    alumnoId: reporte.alumnoId,
    nombre: reporte.nombre,
    objetivo: reporte.objetivo,
    estado,
    motivo,
    metricas: [
      { etiqueta: "Finalizadas", valor: `${reporte.sesionesHechas}/${reporte.sesionesAsignadas}` },
      { etiqueta: "Cumplimiento", valor: `${reporte.pctSesiones}%` },
      { etiqueta: "Última sesión", valor: reporte.ultimaSesion ?? "Sin registro" },
    ],
  };
}

function progreso(reporte: ReporteAlumno): AlumnoReporteVip {
  const sinPeso = reporte.pesoActual === null;
  const sinSeguimiento = reporte.diasConSeguimiento === 0;
  const estado: EstadoReporteVip = sinPeso || sinSeguimiento ? "atencion" : "informativo";
  const motivo = sinPeso
    ? "No tiene peso registrado en los últimos 30 días"
    : sinSeguimiento
      ? "No completó seguimientos durante la última semana"
      : "Progreso disponible para revisión del entrenador";

  return {
    alumnoId: reporte.alumnoId,
    nombre: reporte.nombre,
    objetivo: reporte.objetivo,
    estado,
    motivo,
    metricas: [
      { etiqueta: "Peso actual", valor: numero(reporte.pesoActual, " kg") },
      { etiqueta: "Variación 30 días", valor: reporte.pesoVariacion === null ? "Sin comparación" : `${reporte.pesoVariacion > 0 ? "+" : ""}${reporte.pesoVariacion} kg` },
      { etiqueta: "Seguimientos", valor: `${reporte.diasConSeguimiento}/7` },
    ],
  };
}

function atencion(reporte: ReporteAlumno): AlumnoReporteVip | null {
  const causas: string[] = [];
  if (reporte.estado === "atencion") causas.push(reporte.motivo);
  if (reporte.molestias.length > 0) causas.push("Reportó molestias esta semana");
  if (reporte.pesoActual === null) causas.push("Sin peso en los últimos 30 días");
  if (causas.length === 0) return null;

  return {
    alumnoId: reporte.alumnoId,
    nombre: reporte.nombre,
    objetivo: reporte.objetivo,
    estado: "atencion",
    motivo: causas.join(" · "),
    metricas: [
      { etiqueta: "Entrenamiento", valor: `${reporte.pctSesiones}%` },
      { etiqueta: "Nutrición", valor: `${reporte.diasConComida}/7 días` },
      { etiqueta: "Seguimiento", valor: `${reporte.diasConSeguimiento}/7 días` },
    ],
  };
}

const META: Record<TipoReporteVip, { titulo: string; descripcion: string; periodo: string }> = {
  atencion: {
    titulo: "Atención hoy",
    descripcion: "Alumnos con señales concretas que conviene revisar.",
    periodo: "Entrenamiento del mes y actividad de los últimos 7–30 días",
  },
  nutricion: {
    titulo: "Reporte nutricional",
    descripcion: "Registro de comidas y cercanía al objetivo calórico.",
    periodo: "Últimos 7 días",
  },
  entrenamiento: {
    titulo: "Reporte de entrenamiento",
    descripcion: "Sesiones finalizadas frente a la frecuencia de la rutina activa.",
    periodo: "Mes calendario actual",
  },
  progreso: {
    titulo: "Reporte de progreso",
    descripcion: "Peso, variación y constancia del seguimiento personal.",
    periodo: "Peso de los últimos 30 días y seguimiento de 7 días",
  },
};

export function construirReporteVip(
  tipo: TipoReporteVip,
  reportes: ReporteAlumno[],
  busqueda = ""
): ResultadoReporteVip {
  const termino = busqueda.trim().toLocaleLowerCase("es");
  const filtrados = termino
    ? reportes.filter((reporte) => reporte.nombre.toLocaleLowerCase("es").includes(termino))
    : reportes;

  const convertidos = filtrados
    .map((reporte) => {
      if (tipo === "nutricion") return nutricion(reporte);
      if (tipo === "entrenamiento") return entrenamiento(reporte);
      if (tipo === "progreso") return progreso(reporte);
      return atencion(reporte);
    })
    .filter((alumno): alumno is AlumnoReporteVip => alumno !== null)
    .sort((a, b) => {
      const prioridad = { atencion: 0, sin_datos: 1, informativo: 2, bien: 3 };
      return prioridad[a.estado] - prioridad[b.estado] || a.nombre.localeCompare(b.nombre, "es");
    });

  const meta = META[tipo];
  return {
    tipo,
    ...meta,
    totalEvaluados: filtrados.length,
    totalCoincidencias: convertidos.length,
    limitado: convertidos.length > LIMITE_RESULTADOS,
    alumnos: convertidos.slice(0, LIMITE_RESULTADOS),
    generadoConIA: false,
  };
}

