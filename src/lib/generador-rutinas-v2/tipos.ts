export const VERSION_ENTREVISTA_VIP_2 = 1 as const;

export type EtapaVida = "joven" | "adulto" | "adulto_mayor";
export type ContextoEspecial =
  | "ninguno"
  | "retorno_inactividad"
  | "embarazo_posparto"
  | "discapacidad_fisica"
  | "discapacidad_sensorial"
  | "discapacidad_intelectual"
  | "fragilidad_riesgo_caida"
  | "deporte_adaptado";

export type NivelExperienciaV2 = "novato" | "intermedio" | "avanzado" | "elite_profesional";
export type ObjetivoVipV2 =
  | "salud"
  | "hipertrofia"
  | "fuerza"
  | "potencia"
  | "perdida_grasa"
  | "recomposicion"
  | "rendimiento"
  | "funcionalidad"
  | "competencia";

export type DivisionCompetitivaV2 =
  | "mens_open"
  | "mens_212"
  | "classic_physique"
  | "mens_physique"
  | "mens_wheelchair"
  | "womens_bodybuilding"
  | "fitness"
  | "figure"
  | "bikini"
  | "womens_physique"
  | "wellness"
  | "fit_model"
  | "otra";

export type FaseCompetitivaV2 =
  | "fuera_temporada"
  | "preparacion_general"
  | "preparacion_especifica"
  | "puesta_a_punto"
  | "post_competencia";

export type EstadoSeguridadV2 = "incompleto" | "habilitado" | "requiere_revision" | "bloqueado";
export type RespuestaSiNo = "sin_responder" | "si" | "no";
export type EstadoFuncion = "sin_responder" | "sin_limitacion" | "limitado" | "requiere_asistencia";
export type TendenciaRendimiento = "sin_datos" | "mejora" | "estable" | "retroceso";
export type NivelRecuperacion = 1 | 2 | 3 | 4 | 5;
export type ModoDistribucionDiasV2 = "recomendada" | "manual";
export type GrupoDosisV2 = "pecho" | "espalda" | "hombros" | "brazos" | "cuadriceps" | "femorales" | "gluteos" | "pantorrillas" | "core";

export type PerfilActualParaV2 = {
  alumnoId: string;
  fechaNacimiento: string | null;
  sexo: string | null;
  objetivoPrincipal: string | null;
  objetivoSecundario: string | null;
  diasDisponibles: number | null;
  minutosSesion: number | null;
  experiencia: string | null;
  preferenciaEquipo: string | null;
  actividadesAdicionales: string | null;
  ejerciciosPreferidos: string | null;
  ejerciciosNoDeseados: string | null;
  molestias: string | null;
  lesionesDiagnosticadas: string | null;
  operacionesPrevias: string | null;
  condicionesMedicas: string | null;
  medicamentosRelevantes: string | null;
  autorizacionMedica: boolean;
  categoriaCompetencia: string | null;
};

export type EntrevistaVipV2 = {
  version: typeof VERSION_ENTREVISTA_VIP_2;
  alumnoId: string;
  persona: {
    etapaVida: EtapaVida;
    edad: number | null;
    contextos: ContextoEspecial[];
    modalidad: "individual" | "grupal";
  };
  seguridad: {
    sintomasAlarma: RespuestaSiNo;
    condicionInestable: RespuestaSiNo;
    dolorActual: RespuestaSiNo;
    cirugiaReciente: RespuestaSiNo;
    altaProfesionalSiAplica: RespuestaSiNo;
    caidasRecientes: RespuestaSiNo;
    requiereCoordinacionProfesional: RespuestaSiNo;
    detalle: string;
  };
  funcion: {
    movilidad: EstadoFuncion;
    estabilidad: EstadoFuncion;
    controlTronco: EstadoFuncion;
    agarre: EstadoFuncion;
    transferencia: EstadoFuncion;
    equilibrio: EstadoFuncion;
    rangoActivo: EstadoFuncion;
    comunicacion: EstadoFuncion;
    ayudasTecnicas: string;
  };
  experiencia: {
    practicaConsistenteMeses: number | null;
    tecnicaReproducible: RespuestaSiNo;
    estimaRir: RespuestaSiNo;
    registraCargas: RespuestaSiNo;
    autorregula: RespuestaSiNo;
    nivelDeclarado: NivelExperienciaV2;
  };
  objetivo: {
    principal: ObjetivoVipV2 | null;
    secundario: ObjetivoVipV2 | null;
    plazoSemanas: number | null;
    noSacrificar: string;
  };
  competencia: {
    compite: RespuestaSiNo;
    division: DivisionCompetitivaV2 | null;
    otraDivision: string;
    fase: FaseCompetitivaV2 | null;
    fechaEvento: string | null;
    puntosDebiles: string;
    equipoApoyo: string;
  };
  dosisReciente: {
    estadoHistorial: "sin_responder" | "con_historial" | "novato_sin_historial" | "retorno_sin_historial";
    semanasObservadas: number;
    diasPorSemana: number | null;
    seriesPorGrupo: Record<GrupoDosisV2, number | null>;
    rirHabitual: number | null;
    tendenciaRendimiento: TendenciaRendimiento;
    adherenciaPorcentaje: number | null;
  };
  recuperacion: {
    sueno: NivelRecuperacion | null;
    energia: NivelRecuperacion | null;
    estres: NivelRecuperacion | null;
    doms: NivelRecuperacion | null;
    apetito: NivelRecuperacion | null;
    actividadConcurrente: string;
  };
  recursos: {
    modoDistribucionDias: ModoDistribucionDiasV2;
    diasReales: number | null;
    minutosSesion: number | null;
    equipo: "sin_responder" | "gimnasio_completo" | "maquinas" | "peso_libre" | "casa" | "adaptado";
    supervision: "sin_responder" | "siempre" | "parcial" | "sin_supervision";
    accesibilidad: string;
  };
  preferencias: {
    ejerciciosPreferidos: string;
    ejerciciosNoDeseados: string;
    toleranciaSesionLarga: RespuestaSiNo;
    estiloComoInfluencia: "ninguna" | "hit" | "volumen_clasico" | "hibrido" | "rir_autoregulado";
  };
  medicion: {
    metricas: Array<"carga" | "repeticiones" | "rir" | "perimetros" | "rendimiento" | "dolor" | "fatiga" | "asistencia">;
    revisionCadaSemanas: number | null;
  };
};

export type ResultadoEntrevistaVipV2 = {
  estadoSeguridad: EstadoSeguridadV2;
  razonesSeguridad: string[];
  nivelExperienciaCalculado: NivelExperienciaV2;
  preguntasPendientes: string[];
  puedeCalcularDosis: boolean;
  puedeConstruirSemana: boolean;
  confianza: "baja" | "media" | "alta";
};

export const GRUPOS_DOSIS_V2: readonly GrupoDosisV2[] = [
  "pecho",
  "espalda",
  "hombros",
  "brazos",
  "cuadriceps",
  "femorales",
  "gluteos",
  "pantorrillas",
  "core",
];

export function crearEntrevistaVipV2(alumnoId: string): EntrevistaVipV2 {
  return {
    version: VERSION_ENTREVISTA_VIP_2,
    alumnoId,
    persona: { etapaVida: "adulto", edad: null, contextos: ["ninguno"], modalidad: "individual" },
    seguridad: {
      sintomasAlarma: "sin_responder",
      condicionInestable: "sin_responder",
      dolorActual: "sin_responder",
      cirugiaReciente: "sin_responder",
      altaProfesionalSiAplica: "sin_responder",
      caidasRecientes: "sin_responder",
      requiereCoordinacionProfesional: "sin_responder",
      detalle: "",
    },
    funcion: {
      movilidad: "sin_responder",
      estabilidad: "sin_responder",
      controlTronco: "sin_responder",
      agarre: "sin_responder",
      transferencia: "sin_responder",
      equilibrio: "sin_responder",
      rangoActivo: "sin_responder",
      comunicacion: "sin_responder",
      ayudasTecnicas: "",
    },
    experiencia: {
      practicaConsistenteMeses: null,
      tecnicaReproducible: "sin_responder",
      estimaRir: "sin_responder",
      registraCargas: "sin_responder",
      autorregula: "sin_responder",
      nivelDeclarado: "novato",
    },
    objetivo: { principal: null, secundario: null, plazoSemanas: null, noSacrificar: "" },
    competencia: {
      compite: "sin_responder",
      division: null,
      otraDivision: "",
      fase: null,
      fechaEvento: null,
      puntosDebiles: "",
      equipoApoyo: "",
    },
    dosisReciente: {
      estadoHistorial: "sin_responder",
      semanasObservadas: 0,
      diasPorSemana: null,
      seriesPorGrupo: Object.fromEntries(GRUPOS_DOSIS_V2.map((grupo) => [grupo, null])) as Record<GrupoDosisV2, number | null>,
      rirHabitual: null,
      tendenciaRendimiento: "sin_datos",
      adherenciaPorcentaje: null,
    },
    recuperacion: { sueno: null, energia: null, estres: null, doms: null, apetito: null, actividadConcurrente: "" },
    recursos: { modoDistribucionDias: "recomendada", diasReales: null, minutosSesion: null, equipo: "sin_responder", supervision: "sin_responder", accesibilidad: "" },
    preferencias: { ejerciciosPreferidos: "", ejerciciosNoDeseados: "", toleranciaSesionLarga: "sin_responder", estiloComoInfluencia: "ninguna" },
    medicion: { metricas: [], revisionCadaSemanas: null },
  };
}
