"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { esTecnicaEncadenada, normalizarTecnicaSesion } from "@/lib/entrenamiento/motor-tecnicas-sesion";
import { tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import { bloquesPermanecenUnidos, cargasSonComparables, sustitucionEsCompatible, validarConjuntoOrdenado } from "@/lib/entrenamiento/personalizacion-sesion";

type ResultadoPersonalizacion = { ok: boolean; error: string | null };

function faltaMigracion(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /sesion_ejercicio_personalizaciones/i.test(error.message ?? "")));
}

async function validarSesionPropia(
  sesionId: string,
  alumnoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("sesiones_entrenamiento")
    .select("alumno_id, estado")
    .eq("id", sesionId)
    .maybeSingle();
  if (error || !data || data.alumno_id !== alumnoId) return { ok: false, error: "La sesión no pertenece a tu cuenta." };
  if (data.estado !== "en_progreso") return { ok: false, error: "Sólo puedes personalizar una sesión en progreso." };
  return { ok: true };
}

export async function sustituirEjercicioSesionV2(input: {
  sesionEjercicioId: string;
  ejercicioSustitutoId: string;
  motivo?: string;
}): Promise<ResultadoPersonalizacion> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes sustituir ejercicios en modo solo lectura." };
  const sesionEjercicioId = input.sesionEjercicioId.trim();
  const sustitutoId = input.ejercicioSustitutoId.trim();
  if (!sesionEjercicioId || !sustitutoId) return { ok: false, error: "La sustitución no es válida." };

  const db = createAdminClient();
  const { data: sesionEjercicio, error: errorSesionEjercicio } = await db
    .from("sesion_ejercicios")
    .select("sesion_id, dia_ejercicio_id")
    .eq("id", sesionEjercicioId)
    .maybeSingle();
  if (errorSesionEjercicio || !sesionEjercicio) return { ok: false, error: "No encontramos ese ejercicio dentro de la sesión." };
  const permiso = await validarSesionPropia(sesionEjercicio.sesion_id, alumnoId);
  if (!permiso.ok) return permiso;

  const { count, error: errorSeries } = await db
    .from("series_realizadas")
    .select("id", { count: "exact", head: true })
    .eq("sesion_ejercicio_id", sesionEjercicioId)
    .eq("realizada", true);
  if (errorSeries) return { ok: false, error: "No pudimos comprobar las series registradas." };
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Desmarca primero las series realizadas de este ejercicio para cambiarlo sin falsear el historial." };
  }

  const { data: prescrito } = await db
    .from("rutina_dia_ejercicios")
    .select("ejercicio_id, grupo_muscular, series_programadas")
    .eq("id", sesionEjercicio.dia_ejercicio_id)
    .maybeSingle();
  if (!prescrito?.ejercicio_id || prescrito.ejercicio_id === sustitutoId) {
    return { ok: false, error: "Elige un ejercicio alternativo diferente al prescrito." };
  }

  const { data: fichas, error: errorFichas } = await db
    .from("ejercicios")
    .select("id, grupo_muscular, categoria, patron_movimiento, equipo, activo, calidad_ficha")
    .in("id", [prescrito.ejercicio_id, sustitutoId]);
  if (errorFichas || !fichas || fichas.length !== 2) return { ok: false, error: "No pudimos validar la compatibilidad del reemplazo." };
  const origen = fichas.find((fila) => fila.id === prescrito.ejercicio_id);
  const sustituto = fichas.find((fila) => fila.id === sustitutoId);
  const fichaOrigen = origen ? { id: origen.id, grupoMuscular: origen.grupo_muscular, categoria: origen.categoria, patronMovimiento: origen.patron_movimiento, equipo: origen.equipo, activo: origen.activo, fichaCompleta: origen.calidad_ficha === "completa" } : null;
  const fichaSustituto = sustituto ? { id: sustituto.id, grupoMuscular: sustituto.grupo_muscular, categoria: sustituto.categoria, patronMovimiento: sustituto.patron_movimiento, equipo: sustituto.equipo, activo: sustituto.activo, fichaCompleta: sustituto.calidad_ficha === "completa" } : null;
  if (!fichaOrigen || !fichaSustituto || !sustitucionEsCompatible(fichaOrigen, fichaSustituto)) {
    return { ok: false, error: "Ese reemplazo no está aprobado o no conserva el patrón del ejercicio." };
  }

  const ahora = new Date().toISOString();
  const { error } = await db.from("sesion_ejercicio_personalizaciones").upsert({
    sesion_ejercicio_id: sesionEjercicioId,
    alumno_id: alumnoId,
    ejercicio_sustituto_id: sustitutoId,
    motivo: input.motivo?.trim().slice(0, 180) || null,
    updated_at: ahora,
  }, { onConflict: "sesion_ejercicio_id" });
  if (error) {
    if (faltaMigracion(error)) return { ok: false, error: "La personalización de sesiones todavía no está habilitada en este entorno." };
    return { ok: false, error: "No pudimos guardar el reemplazo. Intenta nuevamente." };
  }
  // La meta y el Momento Alejandro existentes fueron calculados para el
  // ejercicio prescrito. Se conservan auditables, pero dejan de poder salir.
  await Promise.all([
    db.from("impulso_vip_recomendaciones")
      .update({ estado: "bloqueada", resuelto_en: ahora })
      .eq("sesion_ejercicio_id", sesionEjercicioId)
      .in("estado", ["propuesta", "aprobada", "modificada"]),
    db.from("impulso_vip_intervenciones")
      .update({ estado: "cancelada", resultado: "omitida", verificacion: "datos", resuelta_en: ahora })
      .eq("sesion_ejercicio_id", sesionEjercicioId)
      .in("estado", ["preparada", "mostrada"]),
  ]);
  const cargaComparable = cargasSonComparables(fichaOrigen, fichaSustituto);
  const serieObjetivo = Math.max(1, prescrito.series_programadas);
  await db.from("impulso_vip_intervenciones").upsert({
    sesion_ejercicio_id: sesionEjercicioId,
    alumno_id: alumnoId,
    serie_objetivo: serieObjetivo,
    tipo: "cierre_controlado",
    origen: "metodo_ale",
    firma: "Método de Ale Mendoza",
    instruccion: cargaComparable ? "ÚLTIMA SERIE: TERMINA A 1–2 RIR." : "CARGA NUEVA: TERMINA A 2 RIR.",
    motivo: cargaComparable
      ? "Reemplazo compatible con el mismo implemento; no se aumenta carga durante el cambio."
      : "El implemento cambió: se protege la técnica y se construye una nueva referencia de carga.",
    prescripcion: { ejercicioSustitutoId: sustitutoId, cargaComparable, progresionCarga: false },
    estado: "preparada",
    resultado: null,
    verificacion: null,
    decision_data: { origen: "sustitucion_v2" },
    mostrada_en: null,
    resuelta_en: null,
  }, { onConflict: "sesion_ejercicio_id,serie_objetivo" });
  revalidatePath("/portal-v2/entrenamiento/sesion");
  return { ok: true, error: null };
}

export async function reordenarEjerciciosSesionV2(input: {
  sesionId: string;
  ejerciciosOrdenados: string[];
}): Promise<ResultadoPersonalizacion> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes reordenar en modo solo lectura." };
  const sesionId = input.sesionId.trim();
  const orden = input.ejerciciosOrdenados.map((id) => id.trim()).filter(Boolean);
  if (!sesionId || orden.length === 0 || new Set(orden).size !== orden.length) {
    return { ok: false, error: "El orden enviado no es válido." };
  }
  const permiso = await validarSesionPropia(sesionId, alumnoId);
  if (!permiso.ok) return permiso;

  const db = createAdminClient();
  const { data: filas, error: errorFilas } = await db
    .from("sesion_ejercicios")
    .select("id, dia_ejercicio_id")
    .eq("sesion_id", sesionId);
  if (errorFilas || !filas) return { ok: false, error: "No pudimos leer los ejercicios de la sesión." };
  if (!validarConjuntoOrdenado(filas.map((fila) => fila.id), orden)) {
    return { ok: false, error: "El orden debe incluir exactamente los ejercicios de esta sesión." };
  }

  const { data: prescritos, error: errorPrescritos } = await db
    .from("rutina_dia_ejercicios")
    .select("id, orden, tecnica_tipo")
    .in("id", filas.map((fila) => fila.dia_ejercicio_id))
    .order("orden", { ascending: true });
  if (errorPrescritos || !prescritos) return { ok: false, error: "No pudimos validar las técnicas agrupadas." };
  const sesionIdPorPrescrito = new Map(filas.map((fila) => [fila.dia_ejercicio_id, fila.id]));
  const bloques: string[][] = [];
  for (let indice = 0; indice < prescritos.length;) {
    const actual = prescritos[indice];
    const slug = normalizarTecnicaSesion(actual.tecnica_tipo);
    const encadenada = slug !== null && esTecnicaEncadenada(slug);
    const cantidad = encadenada ? tamanoGrupoTecnica(actual.tecnica_tipo) : 1;
    const bloque = prescritos.slice(indice, indice + Math.max(1, cantidad ?? 1))
      .map((fila) => sesionIdPorPrescrito.get(fila.id))
      .filter((id): id is string => Boolean(id));
    bloques.push(bloque);
    indice += Math.max(1, bloque.length);
  }
  if (!bloquesPermanecenUnidos(orden, bloques)) {
    return { ok: false, error: "Las biseries, trisets y circuitos deben moverse como un bloque completo." };
  }

  const ahora = new Date().toISOString();
  const { error } = await db.from("sesion_ejercicio_personalizaciones").upsert(
    orden.map((sesionEjercicioId, indice) => ({
      sesion_ejercicio_id: sesionEjercicioId,
      alumno_id: alumnoId,
      orden_ejecucion: indice,
      updated_at: ahora,
    })),
    { onConflict: "sesion_ejercicio_id" },
  );
  if (error) {
    if (faltaMigracion(error)) return { ok: false, error: "El orden personal de sesiones todavía no está habilitado en este entorno." };
    return { ok: false, error: "No pudimos guardar el nuevo orden." };
  }
  revalidatePath("/portal-v2/entrenamiento/sesion");
  return { ok: true, error: null };
}
