import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

export type OrigenRutina = "generador" | "legado_pdf";
type EjercicioCatalogo = { id: string; nombre: string; grupoMuscular: string };
export type HallazgoValidacion = { codigo: string; gravedad: "error" | "advertencia"; mensaje: string; dia?: number; orden?: number; ejercicioId?: string | null };
export type AuditoriaDeterminista = { valida: boolean; origen: OrigenRutina; auditadaEn: string; ejerciciosRevisados: number; hallazgos: HallazgoValidacion[] };

/** Puerta única de estructura y catálogo. El generador nunca rescata por
 * nombre un ID ausente o inactivo; esa compatibilidad queda sólo para PDFs. */
export function auditarRutinaDeterminista({ rutina, biblioteca, origen, idsProhibidos = [] }: {
  rutina: RutinaExtraida;
  biblioteca: EjercicioCatalogo[];
  origen: OrigenRutina;
  idsProhibidos?: string[];
}): AuditoriaDeterminista {
  const hallazgos: HallazgoValidacion[] = [];
  const porId = new Map(biblioteca.map((ejercicio) => [ejercicio.id, ejercicio]));
  const prohibidos = new Set(idsProhibidos);
  let ejerciciosRevisados = 0;
  if (!rutina.nombreRutina.trim()) hallazgos.push({ codigo: "RUTINA_SIN_NOMBRE", gravedad: "error", mensaje: "La rutina necesita un nombre." });
  if (!rutina.dias.length) hallazgos.push({ codigo: "RUTINA_SIN_DIAS", gravedad: "error", mensaje: "La rutina no tiene días para publicar." });

  for (const [indiceDia, dia] of rutina.dias.entries()) {
    const numeroDia = dia.numero || indiceDia + 1;
    if (!dia.nombre.trim()) hallazgos.push({ codigo: "DIA_SIN_NOMBRE", gravedad: "error", mensaje: "Todos los días necesitan un nombre.", dia: numeroDia });
    if (dia.tipo === "entrenamiento" && !dia.ejercicios.length) hallazgos.push({ codigo: "DIA_SIN_EJERCICIOS", gravedad: "error", mensaje: `El día "${dia.nombre}" no tiene ejercicios.`, dia: numeroDia });
    let cardioEncontrado = false;
    for (const [indiceEjercicio, ejercicio] of dia.ejercicios.entries()) {
      ejerciciosRevisados++;
      const ubicacion = { dia: numeroDia, orden: indiceEjercicio + 1, ejercicioId: ejercicio.ejercicioId ?? null };
      if (!ejercicio.nombre.trim()) hallazgos.push({ codigo: "EJERCICIO_SIN_NOMBRE", gravedad: "error", mensaje: "Hay un ejercicio sin nombre.", ...ubicacion });
      if (!Number.isFinite(ejercicio.series) || ejercicio.series <= 0) hallazgos.push({ codigo: "SERIES_INVALIDAS", gravedad: "error", mensaje: `"${ejercicio.nombre}" necesita un número de series válido.`, ...ubicacion });
      if (origen === "generador") {
        if (!ejercicio.ejercicioId) {
          hallazgos.push({ codigo: "ID_OBLIGATORIO", gravedad: "error", mensaje: `"${ejercicio.nombre}" no tiene un ID de la biblioteca oficial.`, ...ubicacion });
          continue;
        }
        const catalogado = porId.get(ejercicio.ejercicioId);
        if (!catalogado) {
          hallazgos.push({ codigo: "ID_INACTIVO_O_INEXISTENTE", gravedad: "error", mensaje: `"${ejercicio.nombre}" ya no corresponde a un ejercicio activo de la biblioteca.`, ...ubicacion });
          continue;
        }
        if (prohibidos.has(ejercicio.ejercicioId)) hallazgos.push({ codigo: "EJERCICIO_PROHIBIDO", gravedad: "error", mensaje: `"${catalogado.nombre}" está marcado como prohibido en este brief.`, ...ubicacion });
        if (ejercicio.nombre.trim() !== catalogado.nombre.trim()) hallazgos.push({ codigo: "NOMBRE_NO_CANONICO", gravedad: "advertencia", mensaje: `El ID de "${ejercicio.nombre}" corresponde a "${catalogado.nombre}"; al publicar se usará el catálogo oficial.`, ...ubicacion });
      }
      const catalogado = ejercicio.ejercicioId ? porId.get(ejercicio.ejercicioId) : undefined;
      const esCardio = (catalogado?.grupoMuscular ?? ejercicio.grupoMuscular) === "cardio";
      if (cardioEncontrado && !esCardio) hallazgos.push({ codigo: "CARDIO_NO_ESTA_AL_FINAL", gravedad: "error", mensaje: `"${ejercicio.nombre}" aparece después del bloque de cardio.`, ...ubicacion });
      cardioEncontrado ||= esCardio;
    }
  }
  return { valida: !hallazgos.some((hallazgo) => hallazgo.gravedad === "error"), origen, auditadaEn: new Date().toISOString(), ejerciciosRevisados, hallazgos };
}

export function primerErrorAuditoria(auditoria: AuditoriaDeterminista) {
  return auditoria.hallazgos.find((hallazgo) => hallazgo.gravedad === "error")?.mensaje ?? null;
}
