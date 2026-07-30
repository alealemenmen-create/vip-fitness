"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { calcularResultadoTorneo } from "@/lib/torneos/puntos";
import type { TorneoMetrica } from "@/lib/supabase/types";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

const METRICAS: TorneoMetrica[] = ["peso_baja", "peso_sube", "asistencia", "manual"];

export async function crearTorneo(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const nombre = String(formData.get("nombre") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const metrica = String(formData.get("metrica") || "") as TorneoMetrica;
  const menorEsMejor = formData.get("menor_es_mejor") === "on";
  const unidadManual = String(formData.get("unidad_manual") || "").trim();
  const fechaInicio = String(formData.get("fecha_inicio") || "");
  const horaInicio = String(formData.get("hora_inicio") || "").trim();
  const fechaFin = String(formData.get("fecha_fin") || "");
  const horaFin = String(formData.get("hora_fin") || "").trim();
  const puntosEnJuego = Number(formData.get("puntos_en_juego") || 0);
  // "Lado A" y "Lado B (contrincante)" del formulario — se juntan en una
  // sola lista de participantes, cada uno arranca 'pendiente' hasta que
  // acepte o rechace desde su propio perfil.
  const alumnoIds = [
    ...new Set([...formData.getAll("lado_a").map(String), ...formData.getAll("lado_b").map(String)]),
  ];

  if (!nombre) return fail("Ingresa un nombre para el torneo.");
  if (!METRICAS.includes(metrica)) return fail("Elige una métrica válida.");
  if (!fechaInicio || !fechaFin) return fail("Completa las fechas del torneo.");
  if (fechaFin < fechaInicio) return fail("La fecha de fin no puede ser antes que la de inicio.");
  if (!Number.isFinite(puntosEnJuego) || puntosEnJuego <= 0) {
    return fail("Los puntos en juego deben ser un número mayor a 0.");
  }
  if (alumnoIds.length < 2) return fail("Elige al menos 2 alumnos para que compitan.");

  const admin = createAdminClient();
  const sesion = await requireRol(["entrenador", "admin"]);

  const { data: torneo, error: errorTorneo } = await admin
    .from("torneos")
    .insert({
      nombre,
      descripcion: descripcion || null,
      metrica,
      menor_es_mejor: menorEsMejor,
      unidad_manual: metrica === "manual" ? unidadManual || null : null,
      fecha_inicio: fechaInicio,
      hora_inicio: horaInicio || null,
      fecha_fin: fechaFin,
      hora_fin: horaFin || null,
      puntos_en_juego: Math.round(puntosEnJuego),
      creado_por: sesion.userId,
    })
    .select("id")
    .single();

  if (errorTorneo || !torneo) {
    return fail("No se pudo crear el torneo. Intenta nuevamente.");
  }

  const { error: errorParticipantes } = await admin
    .from("torneo_participantes")
    .insert(alumnoIds.map((alumnoId) => ({ torneo_id: torneo.id, alumno_id: alumnoId })));

  if (errorParticipantes) {
    await admin.from("torneos").delete().eq("id", torneo.id);
    return fail("No se pudo agregar a los participantes. Intenta nuevamente.");
  }

  revalidatePath("/admin/torneos");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return okState;
}

export async function cargarResultadoManual(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const torneoId = String(formData.get("torneo_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  const valor = Number(formData.get("valor"));

  if (!torneoId || !alumnoId) return fail("Faltan datos.");
  if (!Number.isFinite(valor)) return fail("Ingresa un número válido.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("torneo_participantes")
    .update({ resultado_manual: valor })
    .eq("torneo_id", torneoId)
    .eq("alumno_id", alumnoId);

  if (error) return fail("No se pudo guardar el resultado. Intenta nuevamente.");

  revalidatePath("/admin/torneos");
  return okState;
}

/** Calcula el "valor" de cada participante según la métrica del torneo. Las
 * automáticas leen de datos que ya existen; la manual usa lo que cargó el
 * entrenador (ver cargarResultadoManual). */
async function calcularValores(
  admin: ReturnType<typeof createAdminClient>,
  metrica: TorneoMetrica,
  fechaInicio: string,
  fechaFin: string,
  participantes: { alumnoId: string; resultadoManual: number | null }[]
): Promise<Map<string, number>> {
  const ids = participantes.map((p) => p.alumnoId);
  const valores = new Map<string, number>();

  if (metrica === "manual") {
    for (const p of participantes) valores.set(p.alumnoId, p.resultadoManual ?? 0);
    return valores;
  }

  if (metrica === "asistencia") {
    for (const id of ids) valores.set(id, 0);
    const { data: sesiones } = await admin
      .from("sesiones_entrenamiento")
      .select("alumno_id, rutina_dias(tipo)")
      .in("alumno_id", ids)
      .in("estado", ["completada", "finalizada_incompleta"])
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);

    for (const s of sesiones ?? []) {
      const dia = s.rutina_dias as unknown as { tipo: string } | null;
      if (dia?.tipo !== "entrenamiento") continue;
      valores.set(s.alumno_id, (valores.get(s.alumno_id) ?? 0) + 1);
    }
    return valores;
  }

  // peso_baja / peso_sube: diferencia entre el primer y el último registro
  // de peso corporal del alumno dentro del rango de fechas del torneo.
  const { data: pesos } = await admin
    .from("pesos_corporales")
    .select("alumno_id, peso_kg, fecha")
    .in("alumno_id", ids)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });

  const porAlumno = new Map<string, { primero: number; ultimo: number }>();
  for (const p of pesos ?? []) {
    const actual = porAlumno.get(p.alumno_id);
    if (!actual) porAlumno.set(p.alumno_id, { primero: p.peso_kg, ultimo: p.peso_kg });
    else actual.ultimo = p.peso_kg;
  }
  for (const id of ids) {
    const registro = porAlumno.get(id);
    const diferencia = registro ? registro.ultimo - registro.primero : 0;
    // "peso_baja": ganar significa haber bajado más — se invierte el signo
    // para que un valor más alto siga siendo "mejor" en calcularResultadoTorneo.
    valores.set(id, metrica === "peso_baja" ? -diferencia : diferencia);
  }
  return valores;
}

export async function cerrarTorneo(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const torneoId = String(formData.get("torneo_id") || "");
  if (!torneoId) return fail("Falta el torneo.");

  const admin = createAdminClient();
  const { data: torneo } = await admin.from("torneos").select("*").eq("id", torneoId).single();
  if (!torneo) return fail("Torneo no encontrado.");
  if (torneo.cerrado) return fail("Este torneo ya está cerrado.");

  const { data: todosParticipantes } = await admin
    .from("torneo_participantes")
    .select("alumno_id, resultado_manual, estado")
    .eq("torneo_id", torneoId);

  // Solo compiten (y se reparten puntos) los que aceptaron — un pendiente o
  // un rechazo no cuenta.
  const participantes = (todosParticipantes ?? []).filter((p) => p.estado === "aceptado");

  if (participantes.length < 2) {
    return fail("Hacen falta al menos 2 participantes que hayan ACEPTADO para cerrar el torneo.");
  }
  if (torneo.metrica === "manual" && participantes.some((p) => p.resultado_manual === null)) {
    return fail("Falta cargar el resultado de algún participante.");
  }

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombre")
    .in(
      "id",
      participantes.map((p) => p.alumno_id)
    );
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  const valores = await calcularValores(
    admin,
    torneo.metrica,
    torneo.fecha_inicio,
    torneo.fecha_fin,
    participantes.map((p) => ({ alumnoId: p.alumno_id, resultadoManual: p.resultado_manual }))
  );

  const resultados = calcularResultadoTorneo(
    participantes.map((p) => ({
      alumnoId: p.alumno_id,
      nombre: nombres.get(p.alumno_id) ?? "Alumno",
      valor: valores.get(p.alumno_id) ?? 0,
    })),
    torneo.puntos_en_juego,
    torneo.menor_es_mejor
  );

  const { error: errorResultados } = await admin
    .from("torneo_resultados")
    .insert({ torneo_id: torneoId, resultados });
  if (errorResultados) return fail("No se pudo guardar el resultado. Intenta nuevamente.");

  await admin
    .from("torneos")
    .update({ cerrado: true, cerrado_en: new Date().toISOString() })
    .eq("id", torneoId);

  // Cerrar un torneo reparte puntos: entra en el acumulado del ranking.
  updateTag(TAG_RANKING);
  revalidatePath("/admin/torneos");
  revalidatePath("/alumno/ranked");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return okState;
}
