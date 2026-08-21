import type {
  AlertaTipo,
  CalcularRecomendacionInput,
  ConfigProgresion,
  Cumplimiento,
  Dificultad,
  MotivoDecision,
  ObjetivoProgresion,
  Recomendacion,
  SerieHistorial,
  SesionHistorial,
} from "./tipos";

const CONFIG_DEFAULT: ConfigProgresion = {
  aptoProgresion: true,
  tipoProgresion: "doble",
  // 5kg y no 2.5kg: el escalón real más común en la sala (discos de 2.5kg
  // sueltos son mucho menos habituales que los de 5kg) — pedido explícito
  // del entrenador para no forzar a comprar discos nuevos. Se puede seguir
  // ajustando por ejercicio desde el editor de rutina si hace falta un
  // escalón más fino.
  incrementoKg: 5,
  requiereAutorizacion: false,
  rirObjetivo: null,
};

/** Mapea los 4 valores reales de `alumno_perfil.objetivo` (ver
 * `CrearAlumnoForm.tsx`) al tipo interno del motor. Cualquier texto no
 * reconocido (incluido "" / null) cae en 'salud_general', el ajuste más
 * conservador. */
export function objetivoAImpulso(objetivoTexto: string | null | undefined): ObjetivoProgresion {
  switch (objetivoTexto) {
    case "Aumento de masa muscular":
      return "masa";
    case "Pérdida de grasa":
    case "Recomposición corporal":
      return "perdida_grasa";
    case "Mejorar condición física":
    default:
      return "salud_general";
  }
}

/** Técnicas encadenadas o intra-serie (superseries, dropset, rest-pause,
 * myo-reps, AMRAP...) alteran el rendimiento de forma que el historial de una
 * serie tradicional no representa bien. El motor las excluye por completo en
 * vez de arriesgar una recomendación engañosa — `resolverGrupoTecnica` en
 * `tecnica-grupo.ts` ya detecta superserie/biserie/triserie/circuito con las
 * mismas palabras clave; acá se suman las técnicas intra-serie que ese
 * módulo no cubre. */
export function esTecnicaExcluida(tecnicaTipo: string | null | undefined): boolean {
  if (!tecnicaTipo) return false;
  const t = tecnicaTipo.toLowerCase();
  return /superserie|biserie|biset|triserie|circuito|tabata|dropset|drop set|rest.?pause|myo|amrap|cluster/.test(t);
}

function dificultadARir(d: Dificultad | null): number | null {
  switch (d) {
    case "muy_facil":
      return 4;
    case "facil":
      return 3;
    case "justo":
      return 1.5;
    case "dificil":
      return 0.5;
    case "fallo":
      return 0;
    default:
      return null;
  }
}

function esPesoCorporal(sesion: SesionHistorial | undefined): boolean {
  return !!sesion && sesion.series.length > 0 && sesion.series.every((s) => s.esPesoCorporal);
}

function todasCompletaronMaximo(series: SerieHistorial[], max: number): boolean {
  return series.length > 0 && series.every((s) => s.realizada && (s.repsRealizadas ?? 0) >= max);
}

function algunaFalloMinimo(series: SerieHistorial[], min: number): boolean {
  return series.some((s) => !s.realizada || (s.repsRealizadas ?? 0) < min);
}

/** `null` cuando la sesión no tiene ningún dato de peso utilizable (el alumno
 * no cargó peso en ninguna serie): no es que el volumen haya sido 0, es que
 * no hay forma de saberlo. Las series individuales sin peso cargado se
 * ignoran (no cuentan como volumen 0) en vez de penalizar por un dato
 * faltante en lugar de por bajo rendimiento real — decisión de producto,
 * HANDOFF 1.9, ver también línea ~380 donde ya se ignoraba pesoKg null. */
function volumenSesion(sesion: SesionHistorial): number | null {
  let total = 0;
  let huboDatoDePeso = false;
  for (const s of sesion.series) {
    if (!s.realizada || s.repsRealizadas === null) continue;
    if (!s.esPesoCorporal && s.pesoKg === null) continue;
    huboDatoDePeso = true;
    const peso = s.esPesoCorporal ? 1 : s.pesoKg!;
    total += peso * s.repsRealizadas;
  }
  return huboDatoDePeso ? total : null;
}

function totalReps(series: SerieHistorial[]): number {
  return series.reduce((acc, s) => acc + (s.realizada ? (s.repsRealizadas ?? 0) : 0), 0);
}

/** Redondea un peso sugerido al escalón de carga disponible (incrementoKg),
 * para no proponer nunca un peso que no exista de verdad en la sala. */
function redondearAIncremento(pesoBase: number, incrementoKg: number): number {
  if (incrementoKg <= 0) return pesoBase;
  return Math.round(pesoBase / incrementoKg) * incrementoKg;
}

function ultimoPesoTrabajado(sesion: SesionHistorial | undefined): number | null {
  if (!sesion) return null;
  const pesos = sesion.series.filter((s) => s.pesoKg !== null).map((s) => s.pesoKg as number);
  if (pesos.length === 0) return null;
  return Math.max(...pesos);
}

/**
 * A diferencia de `ultimoPesoTrabajado`, no se limita a la sesión más
 * reciente: si esa sesión no tiene ningún peso cargado (el alumno registró
 * repeticiones pero dejó el peso en blanco), sigue buscando hacia atrás en
 * el historial disponible (hasta 3 sesiones, ver `obtenerHistorialParaMotor`)
 * hasta encontrar la última vez que sí se cargó un peso real. Sin esto, una
 * sola sesión sin peso cargado dejaba la sugerencia en blanco para siempre,
 * aunque hubiera un peso real una o dos sesiones más atrás.
 */
function ultimoPesoConocido(historial: SesionHistorial[]): number | null {
  for (const sesion of historial) {
    const peso = ultimoPesoTrabajado(sesion);
    if (peso !== null) return peso;
  }
  return null;
}

function construir(
  regla: Recomendacion["regla"],
  args: {
    peso: number | null;
    rango: { min: number; max: number } | null;
    pesoCorporal: boolean;
    justificacion: string;
    motivos: MotivoDecision[];
    metaTotalReps?: number | null;
    alertaTipo?: AlertaTipo | null;
  }
): Recomendacion {
  return {
    regla,
    pesoSugeridoKg: args.peso,
    repsObjetivoMin: args.rango?.min ?? null,
    repsObjetivoMax: args.rango?.max ?? null,
    esPesoCorporal: args.pesoCorporal,
    justificacion: args.justificacion,
    motivos: args.motivos,
    metaTotalReps: args.metaTotalReps ?? null,
    alertaTipo: args.alertaTipo ?? null,
  };
}

/**
 * Motor de reglas puro de la doble progresión (Fase 1 de Impulso VIP).
 *
 * Sin llamadas a Supabase ni a IA: recibe todo por parámetro, para que sea
 * 100% testeable sin mocks. Orden de evaluación: E → D → B → A → C. E y D
 * pueden cortar la progresión (dolor, estancamiento, fallos repetidos); B y A
 * son los dos caminos normales de avance; C es el resultado conservador de
 * respaldo cuando ninguno de los anteriores aplica con confianza (esfuerzo
 * muy alto, un fallo aislado, o un ejercicio sin margen para subir peso).
 */
export function calcularRecomendacion(input: CalcularRecomendacionInput): Recomendacion {
  const { objetivo, rango, config, historialUltimasSesiones: historial } = input;
  const cfg = config ?? CONFIG_DEFAULT;
  const ultima = historial[0];
  const anterior = historial[1];
  const previa = historial[2];

  // Ejercicio sin historial: primera vez que se registra. No hay de dónde
  // partir, así que la meta es simplemente el rango que ya definió el
  // entrenador.
  if (!ultima || ultima.series.length === 0) {
    return construir("A_subir_reps", {
      peso: null,
      rango,
      pesoCorporal: false,
      justificacion: "Primera vez que registras este ejercicio: sigue el rango indicado por tu entrenador.",
      motivos: ["sin_historial"],
    });
  }

  const pesoCorporal = esPesoCorporal(ultima);
  const pesoActual = ultimoPesoConocido(historial);
  // Sin lever de peso (ejercicio de peso corporal, o entrenador lo marcó como
  // 'manual'/'solo_reps'), la progresión solo puede jugar con repeticiones.
  const tipoEfectivo = pesoCorporal && cfg.tipoProgresion === "doble" ? "solo_reps" : cfg.tipoProgresion;

  // El entrenador decidió llevar este ejercicio a mano: el motor no propone
  // nada, solo repite el rango vigente.
  if (tipoEfectivo === "manual") {
    return construir("C_mantener", {
      peso: pesoActual,
      rango,
      pesoCorporal,
      justificacion: "Tu entrenador ajusta este ejercicio directamente.",
      motivos: ["tipo_manual"],
    });
  }

  // --- Regla E: consultar al entrenador (siempre gana, es seguridad) -----
  if (ultima.dolorReportado) {
    return construir("E_consultar", {
      peso: null,
      rango: null,
      pesoCorporal,
      justificacion: "Progresión pausada: reportaste una molestia la última vez. No sigas aumentando la carga en este ejercicio hasta recibir indicaciones de tu entrenador.",
      motivos: ["dolor_reportado"],
      alertaTipo: "dolor",
    });
  }

  const haySuficienteHistorial = [ultima, anterior, previa].filter(Boolean).length >= 3;
  if (haySuficienteHistorial && anterior && previa) {
    const volUltima = volumenSesion(ultima);
    const volAnterior = volumenSesion(anterior);
    const volPrevia = volumenSesion(previa);
    const sinAvance =
      !todasCompletaronMaximo(ultima.series, rango.max) &&
      !todasCompletaronMaximo(anterior.series, rango.max) &&
      !todasCompletaronMaximo(previa.series, rango.max) &&
      volUltima !== null &&
      volAnterior !== null &&
      volPrevia !== null &&
      volUltima <= volAnterior &&
      volAnterior <= volPrevia;
    if (sinAvance) {
      return construir("E_consultar", {
        peso: null,
        rango: null,
        pesoCorporal,
        justificacion: "Revisión requerida: llevas 3 sesiones sin progresar en este ejercicio. Mantén una carga segura y espera a que tu entrenador lo revise.",
        motivos: ["estancamiento_3_sesiones"],
        alertaTipo: "estancamiento_3_sesiones",
      });
    }
  }

  if (anterior) {
    const volumenActual = volumenSesion(ultima);
    const volumenAnterior = volumenSesion(anterior);
    if (volumenAnterior !== null && volumenActual !== null && volumenAnterior > 0 && volumenActual < volumenAnterior * 0.7) {
      return construir("E_consultar", {
        peso: null,
        rango: null,
        pesoCorporal,
        justificacion: "Revisión requerida: tu rendimiento cayó bastante respecto a la sesión anterior. Consulta con tu entrenador antes de seguir.",
        motivos: ["caida_rendimiento"],
        alertaTipo: "caida_rendimiento",
      });
    }
  }

  // --- Regla D: reducir ---------------------------------------------------
  // En pérdida de grasa se prioriza mantener el rendimiento (Regla C) por
  // sobre reducir carga: no completar el mínimo una vez no es necesariamente
  // una señal de sobreentrenamiento cuando hay déficit calórico de por medio.
  const toleranciaFallos = objetivo === "perdida_grasa" ? 3 : 2;
  const sesionesParaFallo = historial.slice(0, toleranciaFallos);
  const fallosConsecutivos =
    sesionesParaFallo.length >= toleranciaFallos &&
    sesionesParaFallo.every((s) => algunaFalloMinimo(s.series, rango.min));
  if (fallosConsecutivos) {
    // Sin un peso real de dónde partir (pesoCorporal, o nunca se cargó un
    // peso en este ejercicio) no hay nada que reducir en un 92.5% -- eso
    // daba antes un "sube a 0kg" sin sentido. Se deja pesoSugeridoKg en
    // null igual que hace la Regla B en el mismo caso.
    const sinPesoDeReferencia = pesoCorporal || pesoActual === null;
    return construir("D_reducir", {
      peso: sinPesoDeReferencia ? null : redondearAIncremento((pesoActual as number) * 0.925, cfg.incrementoKg),
      rango,
      pesoCorporal,
      justificacion: !pesoCorporal && pesoActual === null
        ? `No completaste el mínimo de ${rango.min} repeticiones en tus últimas sesiones. Aún no hay un peso registrado en este ejercicio para poder ajustarlo -- anota el que uses hoy.`
        : `No completaste el mínimo de ${rango.min} repeticiones en tus últimas sesiones. Bajamos un poco la carga para recuperar buena técnica.`,
      motivos: ["fallos_consecutivos_minimo"],
      metaTotalReps: input.seriesProgramadas * rango.min,
    });
  }

  // Con una sola sesión de historial todavía no hay confianza suficiente
  // para decisiones agresivas: la meta de reps se limita a +1 (no +2), y no
  // se sugiere subir peso si no sabemos qué tan difícil fue esa sesión.
  const esPrimeraSesionConDatos = historial.length === 1;

  const completoMaximo = todasCompletaronMaximo(ultima.series, rango.max);
  const rir = dificultadARir(ultima.dificultadPercibida);
  // Si el entrenador fijó un RIR objetivo para este ejercicio, se usa esa
  // comparación numérica en vez de solo la etiqueta de dificultad.
  const esfuerzoAlto =
    cfg.rirObjetivo !== null && rir !== null
      ? rir < cfg.rirObjetivo
      : ultima.dificultadPercibida === "dificil" || ultima.dificultadPercibida === "fallo";
  const sinDatoDeDificultad = ultima.dificultadPercibida === null;

  // --- Regla B: subir peso -------------------------------------------------
  if (completoMaximo && tipoEfectivo !== "solo_reps" && esPrimeraSesionConDatos && sinDatoDeDificultad) {
    return construir("C_mantener", {
      peso: pesoActual,
      rango,
      pesoCorporal,
      justificacion: "Completaste el rango, pero todavía no registraste qué tan difícil te resultó. Repite el mismo peso y cuéntanos la dificultad al terminar para poder subir la carga la próxima vez.",
      motivos: ["completo_maximo", "primera_sesion_sin_dificultad"],
      metaTotalReps: totalReps(ultima.series),
    });
  }
  if (completoMaximo && tipoEfectivo !== "solo_reps") {
    if (!esfuerzoAlto) {
      const base = pesoActual ?? 0;
      const nuevoPeso = redondearAIncremento(base + cfg.incrementoKg, cfg.incrementoKg);
      return construir("B_subir_peso", {
        peso: pesoActual === null ? null : nuevoPeso,
        rango,
        pesoCorporal,
        justificacion:
          pesoActual === null
            ? `Completaste el rango de ${rango.max} repeticiones en todas las series. Aún no registraste un peso en este ejercicio -- anota el que uses hoy para que la próxima vez Ale te sugiera cuánto subir.`
            : `Completaste ${rango.max} repeticiones en todas las series con ${pesoActual}kg. Hoy debes subir a ${nuevoPeso}kg y volver a ${rango.min} repeticiones.`,
        motivos: ["completo_maximo", "sin_esfuerzo_alto"],
        metaTotalReps: input.seriesProgramadas * rango.min,
      });
    }
    return construir("C_mantener", {
      peso: pesoActual,
      rango,
      pesoCorporal,
      justificacion: "Completaste el rango, pero con un esfuerzo muy alto. Hoy debes repetir el mismo peso y las mismas repeticiones antes de subir la carga.",
      motivos: ["completo_maximo", "esfuerzo_alto"],
      metaTotalReps: totalReps(ultima.series),
    });
  }

  if (completoMaximo && tipoEfectivo === "solo_reps") {
    return construir("C_mantener", {
      peso: pesoActual,
      rango,
      pesoCorporal,
      justificacion: "Completaste el máximo de repeticiones sin carga extra. Consulta a tu entrenador para sumar lastre o progresar de otra forma.",
      motivos: ["max_sin_lever_de_peso"],
      metaTotalReps: totalReps(ultima.series),
    });
  }

  // --- Regla A: subir repeticiones ------------------------------------------
  // El objetivo ajusta la agresividad (tope de reps, tolerancia de la Regla
  // D), no reemplaza el árbol de decisión: en pérdida de grasa Regla A sigue
  // aplicando dentro del rango, solo que el tope de una sola sesión ya es
  // conservador (+1) para todos los objetivos por igual.
  const falloAislado = algunaFalloMinimo(ultima.series, rango.min);
  if (!falloAislado && !esfuerzoAlto) {
    const totalObjetivo = ultima.series.length * rango.max;
    const totalHecho = totalReps(ultima.series);
    // Con una sola sesión de historial, tope conservador de +1 (no +2).
    const topeReps = esPrimeraSesionConDatos ? 1 : 2;
    const faltan = Math.max(1, Math.min(topeReps, totalObjetivo - totalHecho));
    const meta = totalHecho + faltan;
    return construir("A_subir_reps", {
      peso: pesoActual,
      rango,
      pesoCorporal,
      justificacion:
        pesoActual === null
          ? `Mantén el peso de la última vez e intenta sumar ${faltan === 1 ? "una repetición" : `${faltan} repeticiones`} en total.`
          : `Mantén los ${pesoActual}kg e intenta sumar ${faltan === 1 ? "una repetición" : `${faltan} repeticiones`} en total, sin salir del rango de ${rango.min}-${rango.max}.`,
      motivos: ["dentro_del_rango", "sin_fallo", "sin_esfuerzo_alto"],
      metaTotalReps: meta,
    });
  }

  // --- Regla C: mantener (resultado conservador de respaldo) ---------------
  return construir("C_mantener", {
    peso: pesoActual,
    rango,
    pesoCorporal,
    justificacion:
      objetivo === "perdida_grasa" && falloAislado
        ? "Estás en una etapa de pérdida de grasa. Hoy el objetivo es sostener lo que has venido haciendo: iguala tu última sesión."
        : falloAislado
          ? "La última vez no llegaste al mínimo del rango. Hoy mantén el mismo peso e intenta recuperar tu marca."
          : "La última vez el esfuerzo fue muy alto. Hoy mantén el mismo peso y las mismas repeticiones.",
    motivos: falloAislado ? ["fallo_minimo_aislado"] : ["esfuerzo_alto"],
    metaTotalReps: totalReps(ultima.series),
  });
}

/**
 * Compara lo realizado contra la recomendación para decidir si se cumplió,
 * se superó, quedó parcial o no se cumplió. Pura — no persiste nada.
 *
 * 'E_consultar' nunca se evalúa (no es una meta, no otorga puntos). El resto
 * de las reglas comparan contra `metaTotalReps` (Regla A/D) o contra
 * `pesoSugeridoKg` + `repsObjetivoMin` (Regla B), y 'C_mantener' contra el
 * total de la sesión anterior con una tolerancia razonable.
 */
export function resolverCumplimiento(
  recomendacion: Pick<Recomendacion, "regla" | "pesoSugeridoKg" | "repsObjetivoMin" | "repsObjetivoMax" | "metaTotalReps">,
  seriesRealizadasTodas: SerieHistorial[],
  totalSesionAnterior: number | null,
  /**
   * Series que entraron en la recomendación (congeladas en `decision_data`).
   * `null` = todas, que es el caso de siempre.
   *
   * Sin esto, un ejercicio con drop set en la última serie se evaluaba mal en
   * las dos puntas: la meta se calculó sobre 3 series limpias, pero el total
   * hecho sumaba las 4 — incluida la de la técnica, que justamente tiene
   * muchas más repeticiones. Todo daba "superada" siempre.
   */
  seriesConsideradas: readonly number[] | null = null
): Cumplimiento | null {
  if (recomendacion.regla === "E_consultar") return null;

  const seriesRealizadas = seriesConsideradas
    ? seriesRealizadasTodas.filter((s) => seriesConsideradas.includes(s.numeroSerie))
    : seriesRealizadasTodas;
  const totalHecho = totalReps(seriesRealizadas);
  const max = recomendacion.repsObjetivoMax ?? Infinity;
  const dentroDeRango = seriesRealizadas.every((s) => !s.realizada || (s.repsRealizadas ?? 0) <= max);

  if (recomendacion.regla === "B_subir_peso") {
    const pesoUsado = seriesRealizadas
      .filter((s) => s.pesoKg !== null)
      .reduce<number | null>((max, s) => (max === null ? s.pesoKg : Math.max(max, s.pesoKg as number)), null);
    const usoSugerido =
      recomendacion.pesoSugeridoKg === null ||
      (pesoUsado !== null && pesoUsado >= recomendacion.pesoSugeridoKg - 0.01);
    if (!usoSugerido) return "no_cumplida";

    const min = recomendacion.repsObjetivoMin ?? 0;
    const algunaBajoMinimo = seriesRealizadas.some((s) => !s.realizada || (s.repsRealizadas ?? 0) < min);
    if (algunaBajoMinimo) return "parcial";
    if (totalHecho > seriesRealizadas.length * min) return "superada";
    return "cumplida";
  }

  // A_subir_reps, C_mantener, D_reducir: se juzgan contra la meta total de
  // repeticiones (o, si no hay meta explícita, contra la sesión anterior).
  const meta = recomendacion.metaTotalReps;
  if (meta !== null && meta !== undefined) {
    if (totalHecho >= meta && dentroDeRango) return totalHecho > meta ? "superada" : "cumplida";
    if (totalSesionAnterior !== null && totalHecho > totalSesionAnterior) return "parcial";
    return "no_cumplida";
  }
  if (totalSesionAnterior === null) return null;
  if (totalHecho > totalSesionAnterior) return "superada";
  if (totalHecho >= totalSesionAnterior * 0.95) return "cumplida";
  if (totalHecho > 0) return "parcial";
  return "no_cumplida";
}
