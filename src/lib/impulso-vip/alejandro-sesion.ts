export type NivelEntrenamientoAlejandro = "inicial" | "intermedio" | "avanzado" | "experto";

export type TipoMomentoAlejandro =
  | "cierre_controlado"
  | "repeticion_extra"
  | "rest_pause"
  | "drop_set";

export type PerfilSesionAlejandro = {
  activo: boolean;
  nivel: NivelEntrenamientoAlejandro;
  sesionesValidas: number;
  constancia30Dias: number;
  registroConfiable: boolean;
  exitosRecientes: number;
  desafiosRecientes: number;
  dolorORestriccion: boolean;
  intensidadAltaAutorizada: boolean;
};

export type CandidatoMomentoAlejandro = {
  ejercicioId: string;
  nombre: string;
  totalSeries: number;
  posicion: number;
  compuesto: boolean;
  tecnicaProgramada: boolean;
  perfilRevisado: boolean;
  tecnicasPermitidas: TipoMomentoAlejandro[];
};

export type MomentoSesionAlejandro = {
  id: string;
  ejercicioId: string;
  serieIndice: number;
  tipo: TipoMomentoAlejandro;
  titulo: "MOMENTO IMPULSO VIP";
  instruccion: string;
  apoyo: string;
  mostradoInicial?: boolean;
  /** drop_set, rest_pause o fallo_controlado -- exige el mismo aviso de
   * "supervisión obligatoria" que ya muestra la sesión clásica
   * (MomentoImpulsoEnVivo.tsx). Se calcula contra el tipo ORIGINAL de la
   * intervención (antes de que `tipoMomento()` en la página de sesión lo
   * agrupe para la UI), porque ese agrupamiento mete "fallo_controlado"
   * dentro de "cierre_controlado" y perdería justo la señal que hace
   * falta para el aviso. */
  intensiva: boolean;
};

export type EstimacionRirAlejandro = {
  rir: number | null;
  confianza: "baja" | "media" | "alta";
  requierePregunta: boolean;
};

/**
 * El cupo no es una recompensa visual: limita deliberadamente las irrupciones.
 * La progresion ordinaria ocurre en silencio y no consume este cupo.
 */
export function resolverCupoAlejandroSesion(perfil: PerfilSesionAlejandro) {
  if (!perfil.activo || perfil.dolorORestriccion) return 0;
  if (perfil.nivel === "inicial" || perfil.sesionesValidas < 6 || !perfil.registroConfiable) return 1;

  const tasaExito = perfil.desafiosRecientes > 0
    ? perfil.exitosRecientes / perfil.desafiosRecientes
    : 0;
  const adherenciaAlta = perfil.constancia30Dias >= 0.75;
  const respuestaConfiable = perfil.desafiosRecientes >= 4 && tasaExito >= 0.7;

  if (perfil.nivel === "intermedio") return adherenciaAlta ? 2 : 1;
  if (perfil.nivel === "avanzado") return adherenciaAlta && respuestaConfiable ? 3 : 2;
  if (adherenciaAlta && respuestaConfiable && perfil.intensidadAltaAutorizada) return 4;
  return 3;
}

function escogerTecnica(candidato: CandidatoMomentoAlejandro, orden: number): TipoMomentoAlejandro {
  const permitidas = candidato.tecnicasPermitidas;
  if (!candidato.compuesto && orden > 0 && permitidas.includes("drop_set")) return "drop_set";
  if (!candidato.compuesto && orden > 0 && permitidas.includes("rest_pause")) return "rest_pause";
  if (permitidas.includes("repeticion_extra")) return "repeticion_extra";
  return "cierre_controlado";
}

function redactarMomento(tipo: TipoMomentoAlejandro) {
  switch (tipo) {
    case "drop_set":
      return { instruccion: "BAJA 20%. SUMA 6–8 REPETICIONES.", apoyo: "Sin descanso. Técnica limpia." };
    case "rest_pause":
      return { instruccion: "DESCANSA 15 S. SUMA 3 REPETICIONES.", apoyo: "Detente si pierdes la técnica." };
    case "repeticion_extra":
      return { instruccion: "ÚLTIMA SERIE: SUPERA TU MARCA POR 1.", apoyo: "La repetición debe ser limpia." };
    default:
      return { instruccion: "ÚLTIMA SERIE: LLEGA A 1 RIR.", apoyo: "Frena antes de romper la técnica." };
  }
}

/** Seleccion estable, dispersa y sin apilar técnicas ya programadas. */
export function seleccionarMomentosAlejandro(
  perfil: PerfilSesionAlejandro,
  candidatos: CandidatoMomentoAlejandro[],
): MomentoSesionAlejandro[] {
  const cupo = resolverCupoAlejandroSesion(perfil);
  if (cupo === 0) return [];

  const elegibles = candidatos
    .filter((item) => item.totalSeries >= 3 && item.perfilRevisado && !item.tecnicaProgramada)
    .sort((a, b) => {
      const puntajeA = (a.compuesto ? 3 : 1) + (a.posicion === 0 ? 2 : 0);
      const puntajeB = (b.compuesto ? 3 : 1) + (b.posicion === 0 ? 2 : 0);
      return puntajeB - puntajeA || a.posicion - b.posicion;
    });

  if (elegibles.length === 0) return [];
  const seleccionados: CandidatoMomentoAlejandro[] = [];
  const primero = elegibles[0];
  seleccionados.push(primero);

  while (seleccionados.length < cupo) {
    const restante = elegibles
      .filter((item) => !seleccionados.includes(item))
      .sort((a, b) => {
        const distanciaA = Math.min(...seleccionados.map((elegido) => Math.abs(elegido.posicion - a.posicion)));
        const distanciaB = Math.min(...seleccionados.map((elegido) => Math.abs(elegido.posicion - b.posicion)));
        return distanciaB - distanciaA || b.posicion - a.posicion;
      })[0];
    if (!restante) break;
    seleccionados.push(restante);
  }

  return seleccionados
    .sort((a, b) => a.posicion - b.posicion)
    .map((candidato, indice) => {
      const tipo = escogerTecnica(candidato, indice);
      const texto = redactarMomento(tipo);
      return {
        id: `${candidato.ejercicioId}-${candidato.totalSeries - 1}-${tipo}`,
        ejercicioId: candidato.ejercicioId,
        serieIndice: candidato.totalSeries - 1,
        tipo,
        titulo: "MOMENTO IMPULSO VIP",
        intensiva: tipo === "drop_set" || tipo === "rest_pause",
        ...texto,
      };
    });
}

/**
 * Sin velocidad de la barra o una respuesta cercana al fallo no se inventa un
 * RIR exacto. Los datos numericos solo permiten omitir la pregunta cuando el
 * patron historico ya es consistente.
 */
export function estimarRirAutomaticoAlejandro(input: {
  repsObjetivo: number;
  repsRealizadas: number;
  rirHistoricoMediano: number | null;
  muestrasComparables: number;
  mismaCarga: boolean;
}): EstimacionRirAlejandro {
  if (!input.mismaCarga || input.muestrasComparables < 3 || input.rirHistoricoMediano === null) {
    return { rir: null, confianza: "baja", requierePregunta: true };
  }
  const ajuste = input.repsRealizadas - input.repsObjetivo;
  const estimado = Math.max(0, Math.min(5, Math.round(input.rirHistoricoMediano + ajuste)));
  return {
    rir: estimado,
    confianza: input.muestrasComparables >= 6 ? "alta" : "media",
    requierePregunta: input.muestrasComparables < 6,
  };
}
