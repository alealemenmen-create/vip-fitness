/**
 * Tipos y etiquetas del saldo de IA, sin nada de servidor.
 *
 * Vive aparte de `saldo.ts` a propósito: ese módulo es `server-only` (crea el
 * cliente de Supabase) y el panel que muestra el saldo es un componente de
 * cliente. Importar el tipo desde ahí arrastraba toda la cadena del servidor
 * al bundle del navegador y rompía el build.
 */

export type DesgloseHerramienta = { herramienta: string; usos: number; usd: number };

export type SaldoIA = {
  /** `false` mientras la migración 0065 no haya corrido en este entorno. */
  disponible: boolean;
  cargadoUsd: number;
  cargadoEn: string | null;
  gastadoDesdeCargaUsd: number;
  restanteUsd: number;
  desglose: DesgloseHerramienta[];
};

/** Nombres en criollo: la tabla guarda la clave técnica. */
export const NOMBRE_HERRAMIENTA: Record<string, string> = {
  revision_rutina: "Revisión de rutinas",
  extraccion_documento: "Lectura de PDF",
  reto: "Retos y reconocimientos",
  atencion: "Asistente · atención",
  nutricion: "Asistente · nutrición",
  entrenamiento: "Asistente · entrenamiento",
  progreso: "Asistente · progreso",
  noticia: "Noticias",
  alumno: "Asistente del alumno",
  eliminar_datos: "Solicitudes de datos",
};
