export type TecnicaEncadenadaSlug = "biserie" | "superserie" | "triserie" | "giant-set" | "circuito";
export type TecnicaIndividualSlug = "drop-set" | "rest-pause" | "fallo-tecnico" | "fst-7" | "myo-reps" | "cluster-set";
export type TecnicaSesionSlug = TecnicaEncadenadaSlug | TecnicaIndividualSlug;

export type EjercicioBloqueSesion = {
  ejercicioId: string;
  series: number;
};

export type PasoBloqueSesion = {
  tipo: "serie" | "descanso_bloque";
  ejercicioId?: string;
  serieNumero?: number;
  ronda: number;
  descansoSegundos?: number;
  posicionBloque?: number;
  totalBloque?: number;
};

export type SegmentoTecnicaSesion = {
  tipo: "trabajo" | "microdescanso" | "ajuste_carga";
  clave: string;
  etiqueta: string;
  reps?: string;
  segundos?: number;
  ajusteCargaPorcentaje?: number;
  completaSerie?: boolean;
};

const ENCADENADAS = new Set<TecnicaEncadenadaSlug>([
  "biserie",
  "superserie",
  "triserie",
  "giant-set",
  "circuito",
]);

export function normalizarTecnicaSesion(texto: string | null | undefined): TecnicaSesionSlug | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/_/g, "-");
  if (/giant\s*set|serie gigante/.test(t)) return "giant-set";
  if (/rest.?pause/.test(t)) return "rest-pause";
  if (/drop\s*set|dropset/.test(t)) return "drop-set";
  if (/myo/.test(t)) return "myo-reps";
  if (/cluster/.test(t)) return "cluster-set";
  if (/fst.?7/.test(t)) return "fst-7";
  if (/fallo/.test(t)) return "fallo-tecnico";
  if (/superserie/.test(t)) return "superserie";
  if (/biserie|biset/.test(t)) return "biserie";
  if (/triserie/.test(t)) return "triserie";
  if (/circuito|tabata/.test(t)) return "circuito";
  return null;
}

export function esTecnicaEncadenada(slug: TecnicaSesionSlug): slug is TecnicaEncadenadaSlug {
  return ENCADENADAS.has(slug as TecnicaEncadenadaSlug);
}

/**
 * Convierte A/B/C en A1→B1→C1→descanso→A2… El descanso existe una sola vez
 * al cerrar la ronda, nunca entre estaciones.
 */
export function planificarBloqueEncadenado(input: {
  tecnica: TecnicaEncadenadaSlug;
  ejercicios: EjercicioBloqueSesion[];
  descansoFinalSegundos: number;
  incluirDescansoFinal?: boolean;
}): PasoBloqueSesion[] {
  if (input.ejercicios.length < 2) return [];
  const rondas = Math.max(...input.ejercicios.map((ejercicio) => ejercicio.series), 0);
  const pasos: PasoBloqueSesion[] = [];

  for (let ronda = 1; ronda <= rondas; ronda += 1) {
    const estaciones = input.ejercicios.filter((ejercicio) => ejercicio.series >= ronda);
    estaciones.forEach((ejercicio, posicion) => pasos.push({
      tipo: "serie",
      ejercicioId: ejercicio.ejercicioId,
      serieNumero: ronda,
      ronda,
      posicionBloque: posicion + 1,
      totalBloque: estaciones.length,
    }));
    if (ronda < rondas || input.incluirDescansoFinal) {
      pasos.push({
        tipo: "descanso_bloque",
        ronda,
        descansoSegundos: input.descansoFinalSegundos,
      });
    }
  }
  return pasos;
}

/**
 * Describe lo que ocurre DENTRO de una serie intensa. Estos segmentos se
 * registran como una sola serie externa, pero cada trabajo/pausa es navegable.
 */
export function planificarSegmentosTecnica(input: {
  tecnica: TecnicaIndividualSlug;
  repsBase: string;
  microdescansoSegundos?: number;
  miniSeries?: number;
}): SegmentoTecnicaSesion[] {
  const micro = input.microdescansoSegundos ?? 15;
  switch (input.tecnica) {
    case "drop-set":
      return [
        { tipo: "trabajo", clave: "principal", etiqueta: "Serie principal", reps: input.repsBase },
        { tipo: "ajuste_carga", clave: "descarga", etiqueta: "Baja el peso 20%", ajusteCargaPorcentaje: -20 },
        { tipo: "trabajo", clave: "drop-1", etiqueta: "Continúa sin descanso", reps: "6–8", completaSerie: true },
      ];
    case "rest-pause":
      return [
        { tipo: "trabajo", clave: "principal", etiqueta: "Serie principal", reps: input.repsBase },
        { tipo: "microdescanso", clave: "pausa-1", etiqueta: "Pausa breve", segundos: micro },
        { tipo: "trabajo", clave: "rest-pause-1", etiqueta: "Suma repeticiones", reps: "3–5", completaSerie: true },
      ];
    case "myo-reps": {
      const cantidad = input.miniSeries ?? 4;
      const segmentos: SegmentoTecnicaSesion[] = [
        { tipo: "trabajo", clave: "activacion", etiqueta: "Serie de activación", reps: input.repsBase },
      ];
      for (let indice = 1; indice <= cantidad; indice += 1) {
        segmentos.push({ tipo: "microdescanso", clave: `pausa-${indice}`, etiqueta: "Pausa breve", segundos: micro });
        segmentos.push({
          tipo: "trabajo",
          clave: `mini-${indice}`,
          etiqueta: `Mini-serie ${indice}/${cantidad}`,
          reps: "3–5",
          completaSerie: indice === cantidad,
        });
      }
      return segmentos;
    }
    case "cluster-set": {
      const cantidad = input.miniSeries ?? 4;
      const segmentos: SegmentoTecnicaSesion[] = [];
      for (let indice = 1; indice <= cantidad; indice += 1) {
        segmentos.push({
          tipo: "trabajo",
          clave: `cluster-${indice}`,
          etiqueta: `Bloque ${indice}/${cantidad}`,
          reps: "2–3",
          completaSerie: indice === cantidad,
        });
        if (indice < cantidad) segmentos.push({
          tipo: "microdescanso",
          clave: `pausa-${indice}`,
          etiqueta: "Pausa cluster",
          segundos: micro,
        });
      }
      return segmentos;
    }
    case "fallo-tecnico":
      return [{
        tipo: "trabajo",
        clave: "fallo-tecnico",
        etiqueta: "Hasta la última repetición limpia",
        reps: "Fallo técnico",
        completaSerie: true,
      }];
    case "fst-7":
      // FST-7 modifica el ejercicio completo (7 series reales), no crea siete
      // segmentos dentro de una sola serie. Cada serie externa es un trabajo.
      return [{
        tipo: "trabajo",
        clave: "fst-serie",
        etiqueta: "Contracción máxima",
        reps: "10–15",
        completaSerie: true,
      }];
  }
}

export function configuracionFst7() {
  return { series: 7, reps: "10–15", descansoEntreSeries: 30, descansoFinal: 90 } as const;
}
