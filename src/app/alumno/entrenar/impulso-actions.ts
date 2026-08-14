"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAlumno } from "@/lib/auth";
import { refrescarRecomendacionesFaltantes } from "@/lib/impulso-vip/data";
import type { MomentoAlertaImpulso } from "@/lib/supabase/types";
import type { ResultadoIntervencionImpulso } from "@/lib/supabase/types";
import { calibrarCierreControlado } from "@/lib/impulso-vip/en-vivo";
import { evaluarTecnicaIntensiva } from "@/lib/impulso-vip/elegibilidad";
import type { TipoIntervencionImpulso } from "@/lib/supabase/types";
import { avisarResultadoIntervencion, avisarSolicitudAsistencia } from "@/lib/impulso-vip/avisos-entrenador";

export type ReportarDolorState = { error: string | null; ok: boolean };

const MOMENTOS_VALIDOS = new Set(["antes", "durante", "despues"]);

/**
 * Reporte explícito de dolor/molestia en un ejercicio — acción separada del
 * guardado normal de series (`guardarSeries` en `actions.ts`): reportar
 * dolor es una decisión aparte, no un dato más de la serie.
 *
 * Solo una alerta de tipo 'dolor' por `sesion_ejercicio_id` (índice único en
 * la migración 0043): si el alumno ya la había reportado para este mismo
 * ejercicio de esta sesión, un segundo envío no duplica ni falla — se trata
 * como ya registrado.
 */
export async function reportarDolor(
  _prevState: ReportarDolorState,
  formData: FormData
): Promise<ReportarDolorState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: null, ok: false };

  const sesionEjercicioId = String(formData.get("sesion_ejercicio_id") || "");
  const diaEjercicioId = String(formData.get("dia_ejercicio_id") || "");
  const sesionId = String(formData.get("sesion_id") || "");
  if (!sesionEjercicioId || !diaEjercicioId) return { error: "Falta información del ejercicio.", ok: false };

  const zona = String(formData.get("zona") || "").trim();
  const intensidadRaw = formData.get("intensidad");
  const intensidad = intensidadRaw ? Number(intensidadRaw) : null;
  if (intensidad !== null && (!Number.isInteger(intensidad) || intensidad < 1 || intensidad > 5)) {
    return { error: "La intensidad debe ser un número entre 1 y 5.", ok: false };
  }
  const momentoRaw = String(formData.get("momento") || "");
  const momento: MomentoAlertaImpulso | null = MOMENTOS_VALIDOS.has(momentoRaw)
    ? (momentoRaw as MomentoAlertaImpulso)
    : null;
  const detuvoEjercicio = formData.get("detuvo_ejercicio") === "true";
  const detalle = String(formData.get("detalle") || "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("impulso_vip_alertas").insert({
    alumno_id: alumnoId,
    dia_ejercicio_id: diaEjercicioId,
    sesion_ejercicio_id: sesionEjercicioId,
    tipo: "dolor",
    zona: zona || null,
    intensidad,
    momento,
    detuvo_ejercicio: detuvoEjercicio,
    detalle: detalle || null,
  });

  if (error) {
    // 23505: ya existía una alerta de dolor para este mismo ejercicio de
    // esta sesión (índice único sesion_ejercicio_id+tipo) — no es un error
    // real para el alumno, ya quedó registrado.
    if (error.code === "23505") return { error: null, ok: true };
    return { error: "No fue posible registrar la molestia. Intentá de nuevo.", ok: false };
  }

  if (sesionId) revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  return { error: null, ok: true };
}

/**
 * Intenta rellenar las metas de Impulso VIP que quedaron sin generar al
 * crear la sesión — ver `refrescarRecomendacionesFaltantes`.
 *
 * Se llama sola al entrar a una sesión en progreso (ver
 * `RefrescarRecomendaciones.tsx`), no hace falta que el alumno haga nada.
 * `void`, sin loading ni error visible: si no hay nada que rellenar es un
 * no-op instantáneo, y si algo falla el alumno sigue viendo su sesión igual
 * que siempre — una meta que no aparece no es un error, es el mismo
 * comportamiento de hoy.
 *
 * Solo mientras la sesión sigue `en_progreso`: una vez cerrada, la meta que
 * el alumno vio (o no vio) mientras entrenaba queda fija, igual que ya vale
 * para las que sí se generaron a tiempo.
 */
export async function refrescarRecomendaciones(sesionId: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return;

  const supabase = await createClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (sesion?.estado !== "en_progreso") return;

  await refrescarRecomendacionesFaltantes(supabase, alumnoId, sesionId);
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
}

const RESULTADOS_INTERVENCION = new Set<ResultadoIntervencionImpulso>([
  "lograda",
  "parcial",
  "no_lograda",
  "omitida",
  "omitida_molestia",
]);

export type CalibrarIntervencionState = {
  error: string | null;
  ok: boolean;
  instruccion: string | null;
  tipo: TipoIntervencionImpulso | null;
  prescripcion: Record<string, unknown> | null;
};

export async function calibrarIntervencionEnVivo(
  _prevState: CalibrarIntervencionState,
  formData: FormData
): Promise<CalibrarIntervencionState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "Esta sesion es de solo lectura.", ok: false, instruccion: null, tipo: null, prescripcion: null };

  const intervencionId = String(formData.get("intervencion_id") || "");
  const rir = Number(formData.get("rir"));
  if (!intervencionId || !Number.isInteger(rir) || rir < 0 || rir > 5) {
    return { error: "No se pudo reconocer tu respuesta.", ok: false, instruccion: null, tipo: null, prescripcion: null };
  }

  const supabase = createAdminClient();
  const { data: intervencion } = await supabase
    .from("impulso_vip_intervenciones")
    .select("id, sesion_ejercicio_id, serie_objetivo, instruccion, prescripcion, decision_data, estado")
    .eq("id", intervencionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!intervencion || intervencion.estado !== "preparada") {
    return { error: "Este Momento Impulso ya fue iniciado.", ok: false, instruccion: null, tipo: null, prescripcion: null };
  }

  const { data: ejercicioSesion } = await supabase
    .from("sesion_ejercicios")
    .select("sesion_id, sesiones_entrenamiento!inner(alumno_id, estado)")
    .eq("id", intervencion.sesion_ejercicio_id)
    .maybeSingle();
  const sesion = ejercicioSesion?.sesiones_entrenamiento as unknown as {
    alumno_id: string;
    estado: string;
  } | null;
  const sesionId = ejercicioSesion?.sesion_id ?? null;
  if (!sesionId || !sesion || sesion.alumno_id !== alumnoId || sesion.estado !== "en_progreso") {
    return { error: "Esta sesion ya no se puede modificar.", ok: false, instruccion: null, tipo: null, prescripcion: null };
  }

  const serieCalibracion = Math.max(1, intervencion.serie_objetivo - 1);
  const { data: serie } = await supabase
    .from("series_realizadas")
    .select("id, realizada, peso_kg, es_peso_corporal, reps_realizadas, origen_registro")
    .eq("sesion_ejercicio_id", intervencion.sesion_ejercicio_id)
    .eq("numero_serie", serieCalibracion)
    .maybeSingle();
  if (!serie?.realizada) {
    return { error: "Completa primero la serie anterior.", ok: false, instruccion: null, tipo: null, prescripcion: null };
  }

  let calibrada = calibrarCierreControlado(
    intervencion.instruccion,
    intervencion.prescripcion as Record<string, unknown>,
    rir
  );
  const decisionData = intervencion.decision_data as Record<string, unknown>;
  let tipoFinal: TipoIntervencionImpulso = "cierre_controlado";

  // Elegibilidad dinamica: la biblioteca fija el techo, la ficha y el dolor
  // pueden bloquearlo, y los datos de la serie anterior demuestran si existe
  // margen real. Cualquier consulta incompleta cae al cierre controlado.
  const [{ data: asignacion }, { data: perfil }, { data: dolor }, { data: ejerciciosSesion }] = await Promise.all([
    supabase
      .from("sesion_ejercicios")
      .select(
        "rutina_dia_ejercicios(ejercicio_id, ejercicios(impulso_intensidad_maxima, impulso_tecnicas_permitidas, impulso_requiere_supervision, impulso_perfil_revisado))"
      )
      .eq("id", intervencion.sesion_ejercicio_id)
      .maybeSingle(),
    supabase
      .from("perfiles_entrenamiento")
      .select("experiencia, lesiones_diagnosticadas, condiciones_medicas, requiere_revision")
      .eq("alumno_id", alumnoId)
      .maybeSingle(),
    supabase
      .from("impulso_vip_alertas")
      .select("id")
      .eq("sesion_ejercicio_id", intervencion.sesion_ejercicio_id)
      .eq("tipo", "dolor")
      .in("estado", ["pendiente", "vista"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sesion_ejercicios")
      .select("id")
      .eq("sesion_id", sesionId),
  ]);
  const idsSesion = (ejerciciosSesion ?? []).map((e) => e.id);
  const { data: intensasSesion } = idsSesion.length > 0
    ? await supabase
        .from("impulso_vip_intervenciones")
        .select("id")
        .in("sesion_ejercicio_id", idsSesion)
        .in("tipo", ["drop_set", "rest_pause", "fallo_controlado"])
        .neq("id", intervencion.id)
        .limit(1)
    : { data: [] };

  type ProgramaElegibilidad = {
    ejercicio_id: string | null;
    ejercicios: {
      impulso_intensidad_maxima: "ninguna" | "baja" | "media" | "alta";
      impulso_tecnicas_permitidas: TipoIntervencionImpulso[];
      impulso_requiere_supervision: boolean;
      impulso_perfil_revisado: boolean;
    } | {
      impulso_intensidad_maxima: "ninguna" | "baja" | "media" | "alta";
      impulso_tecnicas_permitidas: TipoIntervencionImpulso[];
      impulso_requiere_supervision: boolean;
      impulso_perfil_revisado: boolean;
    }[] | null;
  };
  const programaCrudo = asignacion?.rutina_dia_ejercicios as unknown as ProgramaElegibilidad | ProgramaElegibilidad[] | null;
  const programa = Array.isArray(programaCrudo) ? programaCrudo[0] ?? null : programaCrudo;
  const ejercicioCrudo = programa?.ejercicios ?? null;
  const ejercicioBiblioteca = Array.isArray(ejercicioCrudo) ? ejercicioCrudo[0] ?? null : ejercicioCrudo;
  const { data: memoriaTecnicas } = programa?.ejercicio_id
    ? await supabase
        .from("impulso_vip_memoria_tecnicas")
        .select("tecnica")
        .eq("alumno_id", alumnoId)
        .eq("ejercicio_id", programa.ejercicio_id)
        .eq("confianza", "retroceder")
    : { data: [] };
  const elegibilidad = evaluarTecnicaIntensiva({
    ejercicioVinculado: !!programa?.ejercicio_id && !!ejercicioBiblioteca,
    perfilEjercicioRevisado: ejercicioBiblioteca?.impulso_perfil_revisado ?? false,
    intensidadMaxima: ejercicioBiblioteca?.impulso_intensidad_maxima ?? "ninguna",
    tecnicasPermitidas: ejercicioBiblioteca?.impulso_tecnicas_permitidas ?? [],
    tecnicasConRetroceso: (memoriaTecnicas ?? []).map((fila) => fila.tecnica as TipoIntervencionImpulso),
    requiereSupervision: ejercicioBiblioteca?.impulso_requiere_supervision ?? true,
    experiencia: perfil?.experiencia ?? null,
    tieneRestriccionMedica:
      !!perfil?.requiere_revision || !!perfil?.lesiones_diagnosticadas?.trim() || !!perfil?.condiciones_medicas?.trim(),
    dolorActivo: !!dolor,
    registroConfiable:
      serie.origen_registro === "directo"
      && serie.reps_realizadas !== null
      && (serie.es_peso_corporal || serie.peso_kg !== null),
    rirCalibracion: rir,
    tecnicasIntensasSesion: intensasSesion?.length ?? 0,
  });

  if (elegibilidad.tecnica === "drop_set") {
    tipoFinal = "drop_set";
    const pesoBase = typeof calibrada.prescripcion.pesoKg === "number" ? calibrada.prescripcion.pesoKg : null;
    const pesoDescarga = pesoBase === null ? null : Math.max(0, Math.round(pesoBase * 0.8 * 2) / 2);
    calibrada = {
      instruccion: `Ultima serie: completa el objetivo principal con tecnica limpia. Sin descansar, reduce ${pesoBase !== null ? `de ${pesoBase} kg a ${pesoDescarga} kg` : "la carga un 20%"} y realiza 6-8 repeticiones controladas. Detente si se rompe el recorrido.`,
      prescripcion: {
        ...calibrada.prescripcion,
        tecnica: "drop_set",
        reduccionPorcentaje: 20,
        pesoDescargaKg: pesoDescarga,
        repsDescargaMin: 6,
        repsDescargaMax: 8,
        requiereSupervision: elegibilidad.requiereSupervision,
      },
    };
  } else if (elegibilidad.tecnica === "rest_pause") {
    tipoFinal = "rest_pause";
    calibrada = {
      instruccion: "Ultima serie: completa el objetivo limpio, descansa 15 segundos sin abandonar el puesto y suma 3-5 repeticiones más. Detente ante una repeticion rota.",
      prescripcion: {
        ...calibrada.prescripcion,
        tecnica: "rest_pause",
        pausaSegundos: 15,
        repsExtraMin: 3,
        repsExtraMax: 5,
        requiereSupervision: elegibilidad.requiereSupervision,
      },
    };
  } else if (elegibilidad.tecnica === "fallo_controlado") {
    tipoFinal = "fallo_controlado";
    calibrada = {
      instruccion: "Ultima serie al fallo tecnico controlado: continua solo mientras mantengas recorrido y control. La primera repeticion rota termina la serie.",
      prescripcion: {
        ...calibrada.prescripcion,
        tecnica: "fallo_controlado",
        requiereSupervision: true,
      },
    };
  }

  const ahora = new Date().toISOString();
  const [{ error: errorSerie }, { error: errorIntervencion }] = await Promise.all([
    supabase
      .from("series_realizadas")
      .update({ rir_estimado: rir })
      .eq("id", serie.id),
    supabase
      .from("impulso_vip_intervenciones")
      .update({
        tipo: tipoFinal,
        instruccion: calibrada.instruccion,
        prescripcion: calibrada.prescripcion,
        decision_data: {
          ...decisionData,
          rirCalibracion: rir,
          serieCalibracion,
          calibradaEn: ahora,
          tecnicaIntensiva: elegibilidad.tecnica,
          motivosBloqueoTecnica: elegibilidad.motivosBloqueo,
        },
      })
      .eq("id", intervencion.id)
      .eq("estado", "preparada"),
  ]);
  if (errorSerie || errorIntervencion) {
    return { error: "No pudimos calibrar la ultima serie. Intenta nuevamente.", ok: false, instruccion: null, tipo: null, prescripcion: null };
  }
  return { error: null, ok: true, instruccion: calibrada.instruccion, tipo: tipoFinal, prescripcion: calibrada.prescripcion };
}

export async function marcarIntervencionMostrada(intervencionId: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!intervencionId || soloLectura) return;
  const supabase = createAdminClient();
  const { data: intervencion } = await supabase.from("impulso_vip_intervenciones")
    .select("decision_data, origen, estado")
    .eq("id", intervencionId).eq("alumno_id", alumnoId).maybeSingle();
  if (!intervencion || intervencion.estado !== "preparada") return;
  const decisionData = intervencion.decision_data as Record<string, unknown>;
  const aprobadaPorAle = typeof decisionData.aprobadaPorAleEn === "string";
  const ahora = new Date().toISOString();
  await supabase
    .from("impulso_vip_intervenciones")
    .update({
      estado: "mostrada",
      mostrada_en: ahora,
      decision_data: {
        ...decisionData,
        modoActivacion:
          intervencion.origen === "personal_ale" || intervencion.origen === "preparada_por_ale"
            ? "personal_ale"
            : aprobadaPorAle
              ? "aprobada_por_ale"
              : "automatica_metodo_ale",
        activadaEn: ahora,
      },
    })
    .eq("id", intervencionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "preparada");
  await supabase.from("impulso_vip_avisos_entrenador").update({
    estado: "automatica",
    respondida_en: ahora,
  }).eq("intervencion_id", intervencionId).eq("estado", "pendiente");
}

/** Firma liviana para recibir una indicación enviada por Ale sin refrescar
 * toda la sesión cada pocos segundos cuando no cambió nada. */
export async function consultarFirmaIntervenciones(sesionId: string): Promise<string> {
  const { alumnoId } = await requireAlumno();
  if (!sesionId) return "";
  const supabase = createAdminClient();
  const { data: sesion } = await supabase.from("sesiones_entrenamiento")
    .select("id").eq("id", sesionId).eq("alumno_id", alumnoId).maybeSingle();
  if (!sesion) return "";
  const { data: ejercicios } = await supabase.from("sesion_ejercicios").select("id").eq("sesion_id", sesionId);
  const ids = (ejercicios ?? []).map((fila) => fila.id);
  if (ids.length === 0) return "";
  const { data } = await supabase.from("impulso_vip_intervenciones")
    .select("id, origen, instruccion, estado").in("sesion_ejercicio_id", ids).order("id");
  return JSON.stringify(data ?? []);
}

export type ResolverIntervencionState = {
  error: string | null;
  ok: boolean;
  verificada: boolean;
};

export type SolicitarAsistenciaState = {
  error: string | null;
  ok: boolean;
};

export type EstadoAsistenciaAlumno = {
  estado: "pendiente" | "voy" | "atendida" | "no_disponible" | "vencida";
  respuesta: string | null;
} | null;

export async function consultarEstadoAsistenciaAle(
  intervencionId: string
): Promise<EstadoAsistenciaAlumno> {
  const { alumnoId } = await requireAlumno();
  if (!intervencionId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("impulso_vip_solicitudes_asistencia")
    .select("estado, respuesta_entrenador, vence_en")
    .eq("intervencion_id", intervencionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!data) return null;
  const vencida = data.estado === "pendiente" && new Date(data.vence_en).getTime() <= Date.now();
  return {
    estado: vencida ? "vencida" : data.estado,
    respuesta: data.respuesta_entrenador,
  };
}

export async function solicitarAsistenciaAle(
  _prevState: SolicitarAsistenciaState,
  formData: FormData
): Promise<SolicitarAsistenciaState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "Esta sesion es de solo lectura.", ok: false };
  const intervencionId = String(formData.get("intervencion_id") || "");
  if (!intervencionId) return { error: "No se encontro el Momento Impulso.", ok: false };

  const supabase = createAdminClient();
  const { data: intervencion } = await supabase
    .from("impulso_vip_intervenciones")
    .select("id, alumno_id, sesion_ejercicio_id, estado")
    .eq("id", intervencionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!intervencion || intervencion.estado === "cancelada" || intervencion.estado === "resuelta") {
    return { error: "Este momento ya no necesita asistencia.", ok: false };
  }

  const { data: ejercicioSesion } = await supabase
    .from("sesion_ejercicios")
    .select("sesiones_entrenamiento!inner(alumno_id, estado)")
    .eq("id", intervencion.sesion_ejercicio_id)
    .maybeSingle();
  const sesion = ejercicioSesion?.sesiones_entrenamiento as unknown as { alumno_id: string; estado: string } | null;
  if (!sesion || sesion.alumno_id !== alumnoId || sesion.estado !== "en_progreso") {
    return { error: "La sesion ya no esta activa.", ok: false };
  }

  const { error } = await supabase.from("impulso_vip_solicitudes_asistencia").insert({
    intervencion_id: intervencion.id,
    alumno_id: alumnoId,
    sesion_ejercicio_id: intervencion.sesion_ejercicio_id,
    mensaje_alumno: "Necesito que Ale me guie en este Momento Impulso.",
  });
  if (error?.code === "23505") return { error: null, ok: true };
  if (error) return { error: "No pudimos avisarle a Ale. Intenta nuevamente.", ok: false };

  await avisarSolicitudAsistencia({
    alumnoId,
    sesionEjercicioId: intervencion.sesion_ejercicio_id,
  }).catch(() => {});

  return { error: null, ok: true };
}

/** Guarda la respuesta sin convertir una declaracion en evidencia numerica.
 * Solo marca `datos` cuando la serie objetivo contiene peso/reps suficientes
 * para demostrar el reto; de lo contrario conserva `declarada`. */
export async function resolverIntervencionEnVivo(
  _prevState: ResolverIntervencionState,
  formData: FormData
): Promise<ResolverIntervencionState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "Esta sesion es de solo lectura.", ok: false, verificada: false };

  const intervencionId = String(formData.get("intervencion_id") || "");
  const resultado = String(formData.get("resultado") || "") as ResultadoIntervencionImpulso;
  if (!intervencionId || !RESULTADOS_INTERVENCION.has(resultado)) {
    return { error: "No se pudo reconocer el resultado.", ok: false, verificada: false };
  }

  const supabase = createAdminClient();
  const { data: intervencion } = await supabase
    .from("impulso_vip_intervenciones")
    .select("id, sesion_ejercicio_id, serie_objetivo, prescripcion, estado")
    .eq("id", intervencionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  // "resuelta" bloquea acá también, no solo en el UPDATE final: un doble
  // envío (doble tap, reintento de red) no puede reescribir un resultado ya
  // guardado — el resultado que vio el alumno es el que queda.
  if (!intervencion || intervencion.estado === "cancelada" || intervencion.estado === "resuelta") {
    return { error: "Esta intervencion ya no esta disponible.", ok: false, verificada: false };
  }

  let verificada = false;
  const repsExtraRaw = String(formData.get("reps_extra") || "").trim();
  const pesoDescargaRaw = String(formData.get("peso_descarga") || "").trim().replace(",", ".");
  const repsExtra = repsExtraRaw ? Number(repsExtraRaw) : null;
  const pesoDescarga = pesoDescargaRaw ? Number(pesoDescargaRaw) : null;
  if ((repsExtra !== null && (!Number.isInteger(repsExtra) || repsExtra < 0 || repsExtra > 100))
      || (pesoDescarga !== null && (!Number.isFinite(pesoDescarga) || pesoDescarga < 0 || pesoDescarga > 1000))) {
    return { error: "Revisa los numeros de la tecnica.", ok: false, verificada: false };
  }
  if (resultado === "lograda") {
    const { data: serie } = await supabase
      .from("series_realizadas")
      .select("peso_kg, reps_realizadas, realizada")
      .eq("sesion_ejercicio_id", intervencion.sesion_ejercicio_id)
      .eq("numero_serie", intervencion.serie_objetivo)
      .maybeSingle();
    const prescripcion = intervencion.prescripcion as Record<string, unknown>;
    const repsObjetivo = typeof prescripcion.repsObjetivo === "number" ? prescripcion.repsObjetivo : null;
    const pesoObjetivo = typeof prescripcion.pesoKg === "number" ? prescripcion.pesoKg : null;
    const repsExtraMin = typeof prescripcion.repsDescargaMin === "number"
      ? prescripcion.repsDescargaMin
      : typeof prescripcion.repsExtraMin === "number"
        ? prescripcion.repsExtraMin
        : null;
    const pesoDescargaObjetivo = typeof prescripcion.pesoDescargaKg === "number" ? prescripcion.pesoDescargaKg : null;
    verificada = !!serie?.realizada
      && (repsObjetivo === null || (serie.reps_realizadas ?? -1) >= repsObjetivo)
      && (pesoObjetivo === null || (serie.peso_kg ?? -1) >= pesoObjetivo)
      && (repsExtraMin === null || (repsExtra ?? -1) >= repsExtraMin)
      && (pesoDescargaObjetivo === null || (pesoDescarga ?? -1) >= pesoDescargaObjetivo - 0.01);
  }

  const { error } = await supabase
    .from("impulso_vip_intervenciones")
    .update({
      estado: "resuelta",
      resultado,
      verificacion: verificada ? "datos" : "declarada",
      resultado_data: {
        repsExtra,
        pesoDescargaKg: pesoDescarga,
      },
      resuelta_en: new Date().toISOString(),
    })
    .eq("id", intervencionId)
    .eq("alumno_id", alumnoId)
    // Sin "resuelta" a propósito: esta es la guarda real contra la carrera
    // (dos envíos casi simultáneos). El chequeo de arriba es solo una salida
    // rápida; si los dos pasan ese chequeo, acá solo el primer UPDATE
    // encuentra la fila todavía en "preparada"/"mostrada" — para cuando el
    // segundo se ejecuta, la fila ya quedó en "resuelta" y no matchea.
    .in("estado", ["preparada", "mostrada"]);

  if (error) return { error: "No pudimos guardar el resultado. Intenta nuevamente.", ok: false, verificada: false };

  await avisarResultadoIntervencion({
    intervencionId,
    alumnoId,
    sesionEjercicioId: intervencion.sesion_ejercicio_id,
    resultado,
  }).catch(() => {});

  return { error: null, ok: true, verificada };
}
