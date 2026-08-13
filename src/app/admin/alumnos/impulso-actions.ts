"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { obtenerSolicitudesAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import type { SolicitudAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import type { TipoIntervencionImpulso } from "@/lib/supabase/types";

const TIPOS_MANUALES = new Set<TipoIntervencionImpulso>([
  "cierre_controlado", "repeticion_objetivo", "tempo_controlado", "pausa_isometrica",
  "serie_descarga", "drop_set", "rest_pause", "fallo_controlado",
]);
const INTENSAS = new Set<TipoIntervencionImpulso>(["drop_set", "rest_pause", "fallo_controlado"]);

export type CrearIndicacionAleState = { error: string | null; ok: boolean; entrega: "en_vivo" | "programada" | null };

function prescripcionManual(tipo: TipoIntervencionImpulso, requiereSupervision: boolean): Record<string, unknown> {
  if (tipo === "drop_set") return { tecnica: tipo, reduccionPorcentaje: 20, repsDescargaMin: 6, repsDescargaMax: 8, requiereSupervision };
  if (tipo === "rest_pause") return { tecnica: tipo, pausaSegundos: 15, repsExtraMin: 3, repsExtraMax: 5, requiereSupervision };
  if (tipo === "fallo_controlado") return { tecnica: tipo, requiereSupervision: true };
  if (tipo === "serie_descarga") return { tecnica: tipo, reduccionPorcentaje: 15 };
  if (tipo === "tempo_controlado") return { tecnica: tipo, excentricaSegundos: 3 };
  if (tipo === "pausa_isometrica") return { tecnica: tipo, pausaSegundos: 2 };
  if (tipo === "repeticion_objetivo") return { tecnica: tipo, repsExtra: 1 };
  return { tecnica: tipo };
}

function instruccionConProtocolo(tipo: TipoIntervencionImpulso, mensaje: string): string {
  if (tipo === "drop_set") return `${mensaje} Protocolo: sin descansar, reduce la carga un 20% y completa 6-8 repeticiones limpias.`;
  if (tipo === "rest_pause") return `${mensaje} Protocolo: descansa 15 segundos y suma 3-5 repeticiones limpias.`;
  if (tipo === "fallo_controlado") return `${mensaje} Protocolo: termina ante la primera repetición con recorrido o técnica rota.`;
  if (tipo === "serie_descarga") return `${mensaje} Protocolo: reduce la carga un 15% y conserva el recorrido completo.`;
  if (tipo === "tempo_controlado") return `${mensaje} Protocolo: usa 3 segundos en la fase de bajada.`;
  if (tipo === "pausa_isometrica") return `${mensaje} Protocolo: sostén 2 segundos en el punto indicado.`;
  return mensaje;
}

export async function crearIndicacionAle(
  _prevState: CrearIndicacionAleState,
  formData: FormData,
): Promise<CrearIndicacionAleState> {
  const sesionEntrenador = await requireRol(["entrenador", "admin"]);
  const alumnoId = String(formData.get("alumno_id") || "");
  const diaEjercicioId = String(formData.get("dia_ejercicio_id") || "");
  const modo = String(formData.get("modo") || "programada") as "en_vivo" | "programada";
  const serie = Number(formData.get("serie_objetivo"));
  const tipo = String(formData.get("tipo") || "") as TipoIntervencionImpulso;
  const instruccion = String(formData.get("instruccion") || "").trim();
  if (!alumnoId || !diaEjercicioId || !Number.isInteger(serie) || serie < 1 || !TIPOS_MANUALES.has(tipo)) {
    return { error: "Faltan datos válidos para la indicación.", ok: false, entrega: null };
  }
  if (instruccion.length < 3 || instruccion.length > 320) {
    return { error: "El mensaje debe tener entre 3 y 320 caracteres.", ok: false, entrega: null };
  }

  const supabase = createAdminClient();
  const { data: asignacion } = await supabase
    .from("rutina_dia_ejercicios")
    .select("id, dia_id, series_programadas, ejercicio_id, rutina_dias!inner(rutinas!inner(alumno_id, activa)), ejercicios(impulso_perfil_revisado, impulso_tecnicas_permitidas, impulso_requiere_supervision)")
    .eq("id", diaEjercicioId)
    .eq("rutina_dias.rutinas.alumno_id", alumnoId)
    .eq("rutina_dias.rutinas.activa", true)
    .maybeSingle();
  type AsignacionIndicacion = {
    id: string; dia_id: string; series_programadas: number; ejercicio_id: string | null; ejercicios: unknown;
  };
  const asignacionTipada = asignacion as unknown as AsignacionIndicacion | null;
  if (!asignacionTipada || serie > asignacionTipada.series_programadas) {
    return { error: "La serie no existe en el ejercicio elegido.", ok: false, entrega: null };
  }
  type PerfilSeguridad = { impulso_perfil_revisado: boolean; impulso_tecnicas_permitidas: string[]; impulso_requiere_supervision: boolean };
  const perfilCrudo = asignacionTipada.ejercicios as PerfilSeguridad | PerfilSeguridad[] | null;
  const perfil = Array.isArray(perfilCrudo) ? perfilCrudo[0] ?? null : perfilCrudo;
  if (INTENSAS.has(tipo) && (!asignacionTipada.ejercicio_id || !perfil?.impulso_perfil_revisado || !perfil.impulso_tecnicas_permitidas.includes(tipo))) {
    return { error: "Ese ejercicio no está revisado o no autoriza esta técnica intensa.", ok: false, entrega: null };
  }
  if (INTENSAS.has(tipo)) {
    const { data: ficha } = await supabase.from("perfiles_entrenamiento")
      .select("lesiones_diagnosticadas, condiciones_medicas, requiere_revision")
      .eq("alumno_id", alumnoId).maybeSingle();
    if (!ficha || ficha.requiere_revision || ficha.lesiones_diagnosticadas?.trim() || ficha.condiciones_medicas?.trim()) {
      return { error: "La ficha médica requiere revisión antes de indicar una técnica intensa.", ok: false, entrega: null };
    }
  }
  const prescripcion = prescripcionManual(tipo, perfil?.impulso_requiere_supervision ?? true);
  const instruccionFinal = instruccionConProtocolo(tipo, instruccion);

  if (modo === "en_vivo") {
    const { data: sesionEjercicio } = await supabase
      .from("sesion_ejercicios")
      .select("id, sesion_id, sesiones_entrenamiento!inner(alumno_id, estado, rutina_iniciada_en)")
      .eq("dia_ejercicio_id", diaEjercicioId)
      .eq("sesiones_entrenamiento.alumno_id", alumnoId)
      .eq("sesiones_entrenamiento.estado", "en_progreso")
      .not("sesiones_entrenamiento.rutina_iniciada_en", "is", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sesionEjercicio) return { error: "Ese ejercicio no está en la sesión activa del alumno.", ok: false, entrega: null };
    if (INTENSAS.has(tipo)) {
      const { count: dolorActivo } = await supabase.from("impulso_vip_alertas")
        .select("id", { count: "exact", head: true }).eq("sesion_ejercicio_id", sesionEjercicio.id)
        .eq("tipo", "dolor").in("estado", ["pendiente", "vista"]);
      if ((dolorActivo ?? 0) > 0) return { error: "Hay dolor activo en este ejercicio. Envía una alternativa controlada.", ok: false, entrega: null };
    }
    const { data: existente } = await supabase.from("impulso_vip_intervenciones")
      .select("id, estado, origen")
      .eq("sesion_ejercicio_id", sesionEjercicio.id).eq("serie_objetivo", serie).maybeSingle();
    if (existente && existente.estado !== "preparada") {
      return { error: "Esa serie ya vio o resolvió otra indicación; elige una serie posterior.", ok: false, entrega: null };
    }
    if (INTENSAS.has(tipo)) {
      const { data: ejerciciosSesion } = await supabase.from("sesion_ejercicios").select("id").eq("sesion_id", sesionEjercicio.sesion_id);
      const ids = (ejerciciosSesion ?? []).map((fila) => fila.id);
      const { count } = ids.length ? await supabase.from("impulso_vip_intervenciones")
        .select("id", { count: "exact", head: true }).in("sesion_ejercicio_id", ids)
        .in("tipo", ["drop_set", "rest_pause", "fallo_controlado"])
        .neq("id", existente?.id ?? "00000000-0000-0000-0000-000000000000")
        .neq("estado", "cancelada") : { count: 0 };
      if ((count ?? 0) >= 1) return { error: "La sesión ya tiene una técnica intensa. Mantén una sola por seguridad.", ok: false, entrega: null };
    }
    const valores = {
      tipo, origen: "personal_ale" as const, firma: "Ale Mendoza · tu entrenador", instruccion: instruccionFinal,
      motivo: "Indicación enviada personalmente por Alejandro durante el entrenamiento.",
      prescripcion, motor_version: "manual_ale_v1", decision_data: { enviadaPor: sesionEntrenador.userId, enviadaEn: new Date().toISOString() },
    };
    const { error } = existente
      ? await supabase.from("impulso_vip_intervenciones").update(valores).eq("id", existente.id).eq("estado", "preparada")
      : await supabase.from("impulso_vip_intervenciones").insert({ ...valores, sesion_ejercicio_id: sesionEjercicio.id, alumno_id: alumnoId, serie_objetivo: serie });
    if (error) return { error: "No se pudo enviar la indicación.", ok: false, entrega: null };
    revalidatePath(`/alumno/entrenar/sesion/${sesionEjercicio.sesion_id}`);
    revalidatePath(`/admin/alumnos/${alumnoId}`);
    return { error: null, ok: true, entrega: "en_vivo" };
  }

  if (INTENSAS.has(tipo)) {
    const { data: asignacionesDia } = await supabase.from("rutina_dia_ejercicios").select("id").eq("dia_id", asignacionTipada.dia_id);
    const idsDia = (asignacionesDia ?? []).map((fila) => fila.id);
    const { count } = idsDia.length ? await supabase.from("impulso_vip_indicaciones_programadas")
      .select("id", { count: "exact", head: true }).eq("alumno_id", alumnoId).eq("estado", "pendiente")
      .in("dia_ejercicio_id", idsDia).in("tipo", ["drop_set", "rest_pause", "fallo_controlado"]) : { count: 0 };
    if ((count ?? 0) >= 1) return { error: "Ese día ya tiene una técnica intensa preparada.", ok: false, entrega: null };
  }
  const { error } = await supabase.from("impulso_vip_indicaciones_programadas").insert({
    alumno_id: alumnoId, dia_ejercicio_id: diaEjercicioId, serie_objetivo: serie,
    tipo, instruccion: instruccionFinal, prescripcion, creada_por: sesionEntrenador.userId,
  });
  if (error?.code === "23505") return { error: "Ya hay una indicación preparada para esa serie.", ok: false, entrega: null };
  if (error) return { error: "No se pudo preparar la indicación. Verifica la migración 0084.", ok: false, entrega: null };
  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return { error: null, ok: true, entrega: "programada" };
}

export async function cancelarIndicacionAle(formData: FormData): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const id = String(formData.get("indicacion_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!id || !alumnoId) return;
  await createAdminClient().from("impulso_vip_indicaciones_programadas")
    .update({ estado: "cancelada" }).eq("id", id).eq("alumno_id", alumnoId).eq("estado", "pendiente");
  revalidatePath(`/admin/alumnos/${alumnoId}`);
}

/** Marca una alerta historica de Impulso como resuelta. */
export async function resolverAlertaImpulso(formData: FormData): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const alertaId = String(formData.get("alerta_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!alertaId) return;

  const supabase = await createClient();
  await supabase
    .from("impulso_vip_alertas")
    .update({ estado: "resuelta", resuelto_en: new Date().toISOString(), resuelto_por: sesion.userId })
    .eq("id", alertaId);
  if (alumnoId) revalidatePath(`/admin/alumnos/${alumnoId}`);
}

export async function responderAsistenciaImpulso(formData: FormData): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  const respuesta = String(formData.get("respuesta") || "");
  if (!solicitudId || !["voy", "atendida", "no_disponible"].includes(respuesta)) return;

  const supabase = createAdminClient();
  await supabase
    .from("impulso_vip_solicitudes_asistencia")
    .update({
      estado: respuesta as "voy" | "atendida" | "no_disponible",
      respuesta_entrenador:
        respuesta === "voy"
          ? "Ale va para alla."
          : respuesta === "atendida"
            ? "Serie atendida por Ale."
            : "Ale no esta disponible; continua con la alternativa segura.",
      respondida_en: new Date().toISOString(),
      respondida_por: sesion.userId,
    })
    .eq("id", solicitudId)
    .in("estado", ["pendiente", "voy"]);

  // El panel consulta solo esta lista cada pocos segundos; no se recalcula la
  // pagina completa de alumnos (reportes, planes y estadisticas) por responder.
}

/** Consulta pequeña para el panel vivo. Evita refrescar toda /admin/alumnos,
 * que también calcula reportes, planes, registros y estadísticas. */
export async function consultarAsistenciasImpulso(): Promise<SolicitudAsistenciaEnVivo[]> {
  await requireRol(["entrenador", "admin"]);
  return obtenerSolicitudesAsistenciaEnVivo(createAdminClient());
}
