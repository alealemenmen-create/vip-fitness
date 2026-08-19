import type { Dificultad, ObjetivoProgresion } from "./tipos";

export const ALEJANDRO_VERSION = "alejandro_v1";

export type RespuestaAlejandro =
  | "muy_facil"
  | "facil"
  | "mas"
  | "justo"
  | "dificil"
  | "fallo"
  | "tecnica"
  | "molestia";

export type TipoEquipoAlejandro = "mancuernas" | "barra" | "maquina" | "peso_corporal" | "otro";
export type ConfianzaAlejandro = "aprendiendo" | "media" | "alta";
export type AccionAlejandro =
  | "preparar"
  | "subir_reps"
  | "subir_carga"
  | "mantener"
  | "reducir"
  | "detener_consultar";

export type MotivoAlejandro =
  | "base_automatica"
  | "progresion_automatica"
  | "dolor_reportado"
  | "tecnica_inestable"
  | "serie_no_completada"
  | "debajo_rango"
  | "doble_progresion_reps"
  | "tope_rango"
  | "respuesta_positiva"
  | "respuesta_justa"
  | "fatiga_acumulada"
  | "historial_consistente"
  | "primeras_senales"
  | "objetivo_conservador";

export interface RangoAlejandro {
  min: number;
  max: number;
}

export interface EvaluarAlejandroInput {
  nombreEjercicio: string;
  equipo: string;
  unidad: "kg" | "lb";
  objetivo: ObjetivoProgresion;
  rango: RangoAlejandro;
  pesoBase: number | null;
  repsRealizadas: number;
  repsObjetivoActual: number;
  respuesta: RespuestaAlejandro | null;
  tecnicaLimpia: boolean;
  serieCompletada: boolean;
  rachaPositivaPrevia: number;
  sesionesExitosasConsecutivas: number;
  caidaRendimiento: boolean;
}

export interface DecisionAlejandro {
  version: typeof ALEJANDRO_VERSION;
  firma: "Alejandro · Impulso VIP";
  accion: AccionAlejandro;
  dificultadCompatible: Dificultad | null;
  tipoEquipo: TipoEquipoAlejandro;
  confianza: ConfianzaAlejandro;
  pesoObjetivo: number | null;
  repsObjetivo: number;
  incrementoAplicado: number;
  bloqueaProgresion: boolean;
  mensaje: string;
  motivos: MotivoAlejandro[];
}

export interface DecisionAutomaticaAlejandro extends DecisionAlejandro {
  respuestaInferida: RespuestaAlejandro;
}

const RESPUESTAS_POSITIVAS = new Set<RespuestaAlejandro>(["mas", "facil", "muy_facil"]);

export function respuestaADificultad(respuesta: RespuestaAlejandro | null): Dificultad | null {
  switch (respuesta) {
    case "muy_facil":
      return "muy_facil";
    case "facil":
    case "mas":
      return "facil";
    case "justo":
      return "justo";
    case "dificil":
      return "dificil";
    case "fallo":
      return "fallo";
    case "tecnica":
      return "dificil";
    default:
      return null;
  }
}

export function detectarTipoEquipoAlejandro(nombreEjercicio: string, equipo: string): TipoEquipoAlejandro {
  const referencia = `${nombreEjercicio} ${equipo}`.toLocaleLowerCase("es");
  if (/mancuerna|dumbbell|\bdb\b/.test(referencia)) return "mancuernas";
  if (/peso corporal|bodyweight|calistenia|sin equipo/.test(referencia)) return "peso_corporal";
  if (/barra|barbell/.test(referencia)) return "barra";
  if (/máquina|maquina|prensa|polea|smith|cable/.test(referencia)) return "maquina";
  return "otro";
}

export function inferirRespuestaAutomaticaAlejandro(input: {
  rango: RangoAlejandro;
  repsRealizadas: number;
  serieCompletada: boolean;
}): RespuestaAlejandro {
  if (!input.serieCompletada) return "fallo";
  if (input.repsRealizadas < input.rango.min) return "dificil";
  if (input.repsRealizadas >= input.rango.max + 3) return "muy_facil";
  if (input.repsRealizadas >= input.rango.max + 1) return "facil";
  return "mas";
}

function convertirSalto(kilos: number, unidad: "kg" | "lb") {
  if (unidad === "kg") return kilos;
  return Math.max(5, Math.round((kilos * 2.20462) / 5) * 5);
}

function saltoBaseKg(tipoEquipo: TipoEquipoAlejandro) {
  if (tipoEquipo === "mancuernas") return 2.5;
  if (tipoEquipo === "barra" || tipoEquipo === "maquina") return 5;
  if (tipoEquipo === "otro") return 2.5;
  return 0;
}

function saltoDeseadoKg(tipoEquipo: TipoEquipoAlejandro, respuesta: RespuestaAlejandro) {
  if (tipoEquipo === "mancuernas") return 2.5;
  if (tipoEquipo === "barra") return respuesta === "mas" ? 5 : 10;
  if (tipoEquipo === "maquina") return respuesta === "muy_facil" ? 15 : respuesta === "facil" ? 10 : 5;
  if (tipoEquipo === "otro") return respuesta === "mas" ? 2.5 : 5;
  return 0;
}

function confianzaDe(input: EvaluarAlejandroInput): ConfianzaAlejandro {
  const evidencia = input.rachaPositivaPrevia + 1 + Math.min(2, input.sesionesExitosasConsecutivas);
  if (evidencia >= 3) return "alta";
  if (evidencia >= 2) return "media";
  return "aprendiendo";
}

function limitePorConfianzaKg(tipo: TipoEquipoAlejandro, confianza: ConfianzaAlejandro) {
  if (tipo === "peso_corporal") return 0;
  if (tipo === "mancuernas") return 2.5;
  if (confianza === "aprendiendo") return saltoBaseKg(tipo);
  if (confianza === "media") return tipo === "maquina" || tipo === "barra" ? 10 : 5;
  return tipo === "maquina" ? 15 : tipo === "barra" ? 10 : 5;
}

function crearDecision(
  input: EvaluarAlejandroInput,
  args: Omit<DecisionAlejandro, "version" | "firma" | "tipoEquipo" | "dificultadCompatible">
): DecisionAlejandro {
  return {
    version: ALEJANDRO_VERSION,
    firma: "Alejandro · Impulso VIP",
    tipoEquipo: detectarTipoEquipoAlejandro(input.nombreEjercicio, input.equipo),
    dificultadCompatible: respuestaADificultad(input.respuesta),
    ...args,
  };
}

/**
 * Capa de decisión en vivo de Alejandro.
 *
 * No reemplaza el motor histórico de doble progresión de Impulso VIP. Lo
 * complementa entre series: primero protege dolor/técnica, luego intenta
 * completar el rango de repeticiones y solamente entonces considera subir
 * carga. La confianza combina señales de la sesión y sesiones anteriores.
 */
export function evaluarSiguienteSerieAlejandro(input: EvaluarAlejandroInput): DecisionAlejandro {
  const tipoEquipo = detectarTipoEquipoAlejandro(input.nombreEjercicio, input.equipo);
  const pesoBase = input.pesoBase;
  const repsBase = Math.max(1, input.repsRealizadas || input.repsObjetivoActual);

  if (input.respuesta === null) {
    return crearDecision(input, {
      accion: "preparar",
      confianza: "aprendiendo",
      pesoObjetivo: pesoBase,
      repsObjetivo: input.repsObjetivoActual,
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: pesoBase === null
        ? `Preparé ${input.repsObjetivoActual} repeticiones. No subiré el estímulo sin comprobar cómo respondió tu serie.`
        : `Preparé la siguiente serie en ${pesoBase} ${input.unidad}. No subiré la carga sin una señal tuya y datos suficientes.`,
      motivos: ["base_automatica"],
    });
  }

  if (input.respuesta === "molestia") {
    return crearDecision(input, {
      accion: "detener_consultar",
      confianza: "alta",
      pesoObjetivo: pesoBase,
      repsObjetivo: Math.max(input.rango.min, Math.min(repsBase, input.rango.max)),
      incrementoAplicado: 0,
      bloqueaProgresion: true,
      mensaje: "Detén la progresión de este ejercicio. Registra la molestia y espera la revisión de tu entrenador antes de aumentar carga o intensidad.",
      motivos: ["dolor_reportado"],
    });
  }

  if (input.respuesta === "tecnica" || !input.tecnicaLimpia) {
    const salto = convertirSalto(saltoBaseKg(tipoEquipo), input.unidad);
    return crearDecision(input, {
      accion: "reducir",
      confianza: "alta",
      pesoObjetivo: pesoBase === null ? null : Math.max(0, pesoBase - salto),
      repsObjetivo: Math.max(input.rango.min, repsBase - 1),
      incrementoAplicado: pesoBase === null ? 0 : -salto,
      bloqueaProgresion: true,
      mensaje: "La técnica perdió calidad. Bajo un nivel y priorizo recorrido y control; hoy no corresponde perseguir más peso.",
      motivos: ["tecnica_inestable"],
    });
  }

  if (input.respuesta === "fallo" || !input.serieCompletada) {
    const salto = convertirSalto(saltoBaseKg(tipoEquipo) * 2, input.unidad);
    return crearDecision(input, {
      accion: "reducir",
      confianza: "alta",
      pesoObjetivo: pesoBase === null ? null : Math.max(0, pesoBase - salto),
      repsObjetivo: Math.max(1, Math.min(input.rango.min, repsBase - 2)),
      incrementoAplicado: pesoBase === null ? 0 : -salto,
      bloqueaProgresion: false,
      mensaje: "La serie no se completó. Reduzco el estímulo para recuperar repeticiones limpias antes de volver a progresar.",
      motivos: ["serie_no_completada"],
    });
  }

  if (input.caidaRendimiento || input.respuesta === "dificil") {
    const salto = convertirSalto(saltoBaseKg(tipoEquipo), input.unidad);
    return crearDecision(input, {
      accion: input.caidaRendimiento ? "mantener" : "reducir",
      confianza: input.caidaRendimiento ? "media" : "alta",
      pesoObjetivo: input.caidaRendimiento || pesoBase === null ? pesoBase : Math.max(0, pesoBase - salto),
      repsObjetivo: Math.max(input.rango.min, repsBase - (input.caidaRendimiento ? 0 : 1)),
      incrementoAplicado: input.caidaRendimiento || pesoBase === null ? 0 : -salto,
      bloqueaProgresion: false,
      mensaje: input.caidaRendimiento
        ? "Tu rendimiento cayó dentro del ejercicio. Mantengo la carga y corto la progresión de hoy para controlar la fatiga."
        : "La serie estuvo demasiado exigente. Bajo un nivel para recuperar una ejecución sólida.",
      motivos: input.caidaRendimiento ? ["fatiga_acumulada"] : ["serie_no_completada"],
    });
  }

  if (input.respuesta === "justo") {
    return crearDecision(input, {
      accion: "mantener",
      confianza: "alta",
      pesoObjetivo: pesoBase,
      repsObjetivo: Math.max(input.rango.min, Math.min(repsBase, input.rango.max)),
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: "El estímulo estuvo en el punto correcto. Mantengo carga y repeticiones para consolidar antes de progresar.",
      motivos: ["respuesta_justa"],
    });
  }

  if (esRespuestaPositivaAlejandro(input.respuesta) && repsBase < input.rango.min) {
    return crearDecision(input, {
      accion: "mantener",
      confianza: "media",
      pesoObjetivo: pesoBase,
      repsObjetivo: input.rango.min,
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: `Primero recupera el mínimo de ${input.rango.min} repeticiones limpias. Todavía no corresponde subir la carga.`,
      motivos: ["debajo_rango"],
    });
  }

  if (esRespuestaPositivaAlejandro(input.respuesta) && repsBase < input.rango.max) {
    const extra = input.respuesta === "muy_facil" ? 3 : input.respuesta === "facil" ? 2 : 1;
    const repsObjetivo = Math.min(input.rango.max, repsBase + extra);
    return crearDecision(input, {
      accion: "subir_reps",
      confianza: confianzaDe(input),
      pesoObjetivo: pesoBase,
      repsObjetivo,
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: `Mantén ${pesoBase === null ? "la misma carga" : `${pesoBase} ${input.unidad}`} y sube a ${repsObjetivo} repeticiones. Primero completamos el rango; después subimos peso.`,
      motivos: ["doble_progresion_reps", "respuesta_positiva"],
    });
  }

  if (!esRespuestaPositivaAlejandro(input.respuesta)) {
    return crearDecision(input, {
      accion: "mantener",
      confianza: "aprendiendo",
      pesoObjetivo: pesoBase,
      repsObjetivo: input.repsObjetivoActual,
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: "Mantengo la prescripción actual hasta contar con una señal suficiente para modificarla.",
      motivos: ["primeras_senales"],
    });
  }

  const confianza = confianzaDe(input);
  const saltoDeseado = saltoDeseadoKg(tipoEquipo, input.respuesta);
  const limiteConfianza = limitePorConfianzaKg(tipoEquipo, confianza);
  const objetivoConservador = input.objetivo === "salud_general" || input.objetivo === "perdida_grasa";
  const limiteObjetivo = objetivoConservador ? saltoBaseKg(tipoEquipo) : limiteConfianza;
  const saltoKg = Math.min(saltoDeseado, limiteConfianza, limiteObjetivo);
  const salto = convertirSalto(saltoKg, input.unidad);

  if (tipoEquipo === "peso_corporal" || pesoBase === null || salto <= 0) {
    const extra = input.respuesta === "muy_facil" ? 3 : input.respuesta === "facil" ? 2 : 1;
    return crearDecision(input, {
      accion: "subir_reps",
      confianza,
      pesoObjetivo: pesoBase,
      repsObjetivo: repsBase + extra,
      incrementoAplicado: 0,
      bloqueaProgresion: false,
      mensaje: `No hay un salto de carga fiable. Mantén el ejercicio y busca ${repsBase + extra} repeticiones limpias.`,
      motivos: ["tope_rango", "respuesta_positiva"],
    });
  }

  const motivos: MotivoAlejandro[] = ["tope_rango", "respuesta_positiva"];
  if (confianza === "aprendiendo") motivos.push("primeras_senales");
  else motivos.push("historial_consistente");
  if (objetivoConservador) motivos.push("objetivo_conservador");

  return crearDecision(input, {
    accion: "subir_carga",
    confianza,
    pesoObjetivo: pesoBase + salto,
    repsObjetivo: input.rango.min,
    incrementoAplicado: salto,
    bloqueaProgresion: false,
    mensaje: confianza === "aprendiendo"
      ? `Veo una primera señal positiva. Subo solo un nivel a ${pesoBase + salto} ${input.unidad} y vuelvo al mínimo del rango para validar la respuesta.`
      : `La respuesta se repite con datos consistentes. Sube a ${pesoBase + salto} ${input.unidad} y vuelve a ${input.rango.min} repeticiones limpias.`,
    motivos,
  });
}

/**
 * Modo entrenador activo. Interpreta el resultado registrado y prescribe la
 * siguiente serie sin esperar una encuesta. Las respuestas manuales quedan
 * como corrección de contexto, no como requisito para que exista progresión.
 */
export function evaluarProgresionAutomaticaAlejandro(
  input: Omit<EvaluarAlejandroInput, "respuesta">
): DecisionAutomaticaAlejandro {
  const respuestaInferida = inferirRespuestaAutomaticaAlejandro({
    rango: input.rango,
    repsRealizadas: input.repsRealizadas,
    serieCompletada: input.serieCompletada,
  });
  const decision = evaluarSiguienteSerieAlejandro({ ...input, respuesta: respuestaInferida });
  return {
    ...decision,
    respuestaInferida,
    motivos: ["progresion_automatica", ...decision.motivos],
    mensaje: `Alejandro actuó automáticamente: ${decision.mensaje}`,
  };
}

export function esRespuestaPositivaAlejandro(
  respuesta: RespuestaAlejandro
): respuesta is "mas" | "facil" | "muy_facil" {
  return RESPUESTAS_POSITIVAS.has(respuesta);
}
