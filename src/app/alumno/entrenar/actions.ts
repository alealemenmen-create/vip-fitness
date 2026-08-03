"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";
import { requireAlumno } from "@/lib/auth";
import {
  abandonarEntrenamiento,
  desactivarEntrenamiento,
  registrarEntrenamiento,
} from "@/lib/ranking/movimientos";

export async function iniciarSesion(formData: FormData): Promise<void> {
  const diaId = String(formData.get("dia_id") || "");
  const rutinaId = String(formData.get("rutina_id") || "");
  const numero = Number(formData.get("numero_calendario") || 0);
  if (!diaId || !rutinaId || !numero) redirect("/alumno/entrenar");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo bloquea si hay una rutina EMPEZADA DE VERDAD (cronómetro corriendo,
  // o un día de descanso, que no tiene ese segundo paso) — una sesión creada
  // por "Ver entrenamiento" en otro día, todavía bloqueada, es solo una vista
  // previa y no debe impedir entrar a mirar/empezar este otro día.
  const { data: candidatas } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, rutina_iniciada_en, rutina_dias(tipo)")
    .eq("alumno_id", user.id)
    .eq("estado", "en_progreso")
    .order("hora_inicio", { ascending: false })
    .limit(20);

  const enProgreso = (candidatas ?? []).find((s) => {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    return dia?.tipo === "descanso" || s.rutina_iniciada_en !== null;
  });

  if (enProgreso) {
    redirect(`/alumno/entrenar/sesion/${enProgreso.id}`);
  }

  const { data: existente } = await supabase
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("alumno_id", user.id)
    .eq("rutina_id", rutinaId)
    .eq("numero_calendario", numero)
    .maybeSingle();

  if (existente) {
    redirect(`/alumno/entrenar/sesion/${existente.id}`);
  }

  const { data: sesion, error: errorSesion } = await supabase
    .from("sesiones_entrenamiento")
    .insert({ alumno_id: user.id, rutina_id: rutinaId, dia_id: diaId, numero_calendario: numero })
    .select("id")
    .single();

  if (errorSesion || !sesion) redirect("/alumno/entrenar");

  const { data: ejercicios } = await supabase
    .from("rutina_dia_ejercicios")
    .select("id")
    .eq("dia_id", diaId);

  if (ejercicios && ejercicios.length > 0) {
    await supabase
      .from("sesion_ejercicios")
      .insert(ejercicios.map((e) => ({ sesion_id: sesion.id, dia_ejercicio_id: e.id })));
  }

  revalidatePath("/alumno/entrenar");
  redirect(`/alumno/entrenar/sesion/${sesion.id}`);
}

/** El alumno ya está en la pantalla de la sesión pero la rutina sigue
 * bloqueada (ver migración 0040): esto la desbloquea y ancla el cronómetro.
 * `is(...null)` la hace idempotente — un doble tap no corre el reloj de
 * nuevo. */
export async function iniciarRutina(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return;

  const supabase = await createClient();
  await supabase
    .from("sesiones_entrenamiento")
    .update({ rutina_iniciada_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .is("rutina_iniciada_en", null);

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
}

export type GuardarSeriesState = { error: string | null };

export async function guardarSeries(
  _prevState: GuardarSeriesState,
  formData: FormData
): Promise<GuardarSeriesState> {
  const sesionEjercicioId = String(formData.get("sesion_ejercicio_id") || "");
  const sesionId = String(formData.get("sesion_id") || "");
  const cantidad = Number(formData.get("cantidad_series") || 0);
  const notaEjercicio = String(formData.get("nota_ejercicio") || "").trim();

  const supabase = await createClient();
  const filas = [];
  let seriesRealizadas = 0;

  for (let i = 1; i <= cantidad; i++) {
    const esPesoCorporal = formData.get(`peso_corporal_${i}`) === "true";
    const realizada = formData.get(`realizada_${i}`) === "true";
    const pesoRaw = formData.get(`peso_${i}`);
    const repsRaw = formData.get(`reps_${i}`);

    const peso = esPesoCorporal ? null : pesoRaw ? Number(String(pesoRaw).replace(",", ".")) : null;
    const reps = repsRaw ? Number(repsRaw) : null;

    if (peso !== null && peso < 0) return { error: "El peso no puede ser negativo." };
    if (reps !== null && reps < 0) return { error: "Las repeticiones no pueden ser negativas." };
    if (realizada) seriesRealizadas++;
    // Se guarda la fila si hay algún dato cargado O si se marcó como
    // realizada (una serie hecha sin cargar número igual cuenta).
    if (peso === null && reps === null && !esPesoCorporal && !realizada) continue;

    filas.push({
      sesion_ejercicio_id: sesionEjercicioId,
      numero_serie: i,
      peso_kg: peso,
      es_peso_corporal: esPesoCorporal,
      reps_realizadas: reps,
      realizada,
    });
  }

  if (filas.length > 0) {
    const { error } = await supabase
      .from("series_realizadas")
      .upsert(filas, { onConflict: "sesion_ejercicio_id,numero_serie" });
    if (error) return { error: "No fue posible guardar las series. Revisa tu conexión e intenta nuevamente." };
  }

  // El ejercicio solo cuenta como realizado si TODAS sus series están
  // marcadas como hechas — cargar un peso/reps por sí solo no alcanza, y
  // dejar algunas sin marcar significa que quedó incompleto.
  const completado = cantidad > 0 && seriesRealizadas === cantidad;
  const { error: errorNota } = await supabase
    .from("sesion_ejercicios")
    .update({
      nota: notaEjercicio || null,
      completado,
      completado_en: completado ? new Date().toISOString() : null,
    })
    .eq("id", sesionEjercicioId);
  if (errorNota) return { error: "No fue posible guardar. Revisa tu conexión e intenta nuevamente." };

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return { error: null };
}

export async function finalizarSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const comentario = String(formData.get("comentario") || "").trim();
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");

  const supabase = await createClient();
  const [{ data: sesion }, { data: ejercicios }] = await Promise.all([
    supabase
      .from("sesiones_entrenamiento")
      .select("id, fecha")
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId)
      .maybeSingle(),
    supabase.from("sesion_ejercicios").select("completado").eq("sesion_id", sesionId),
  ]);
  if (!sesion) redirect("/alumno/entrenar");

  const total = ejercicios?.length ?? 0;
  const completados = ejercicios?.filter((e) => e.completado).length ?? 0;
  // total === 0 pasa en días de descanso (sin ejercicios) — cuentan como completados.
  const estado = completados === total ? "completada" : "finalizada_incompleta";

  await supabase
    .from("sesiones_entrenamiento")
    .update({ estado, hora_fin: new Date().toISOString(), comentario: comentario || null })
    .eq("id", sesionId);

  const puntos = await registrarEntrenamiento({
    alumnoId,
    sesionId,
    fecha: sesion.fecha,
    completados,
    total,
  });

  // Finalizar una sesión cambia los puntos de asistencia: el ranking cacheado
  // tiene que rehacerse ahora, no cuando venza solo.
  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  redirect(`/alumno/entrenar?puntos=${puntos}`);
}

export async function reabrirSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;

  const supabase = await createClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("fecha")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion) return;
  await supabase
    .from("sesiones_entrenamiento")
    .update({ estado: "en_progreso", hora_fin: null })
    .eq("id", sesionId);

  await desactivarEntrenamiento(alumnoId, sesionId, sesion.fecha);

  // Reabrir devuelve el cupo de la sesión, así que también mueve los puntos.
  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
}

/**
 * Abandona una sesión ya cerrada (completada o finalizada incompleta): le
 * quita los puntos que había sumado y queda marcada como "abandonada".
 *
 * A diferencia de `reabrirSesion`, esto no vuelve a quedar editable — la fila
 * NO se borra, queda en el historial con su estado nuevo (a diferencia de un
 * borrado, sigue habiendo registro de que se empezó). Vive acá y se llama
 * desde el Historial, no desde la ficha de la sesión: es una acción sobre
 * algo ya cerrado, no algo que se hace mientras se está entrenando.
 */
export async function abandonarSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;

  const supabase = await createClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("fecha")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion) return;

  await supabase.from("sesiones_entrenamiento").update({ estado: "abandonada" }).eq("id", sesionId);
  await abandonarEntrenamiento(alumnoId, sesionId, sesion.fecha);

  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
}

/**
 * Reinicia una rutina de cero: borra TODAS las sesiones (y en cascada sus
 * ejercicios y series) que el alumno haya registrado bajo esa rutina, para
 * que el calendario de Entrenar vuelva a empezar desde el Día 1.
 *
 * A propósito NO llama a `abandonarEntrenamiento` ni toca
 * `puntos_vip_movimientos`: ese es un registro aparte (clave
 * `entrenamiento:<sesionId>`), sin relación de llave foránea con
 * `sesiones_entrenamiento`, así que borrar las sesiones no le afecta. Los
 * Puntos VIP que el alumno ya ganó quedan intactos — el pedido explícito de
 * "reiniciar sin que afecte el ranking".
 */
export async function reiniciarRutina(formData: FormData): Promise<void> {
  const rutinaId = String(formData.get("rutina_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!rutinaId || soloLectura) return;

  const supabase = await createClient();
  const { data: rutina } = await supabase
    .from("rutinas")
    .select("id")
    .eq("id", rutinaId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!rutina) return;

  await supabase
    .from("sesiones_entrenamiento")
    .delete()
    .eq("rutina_id", rutinaId)
    .eq("alumno_id", alumnoId);

  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  redirect("/alumno/entrenar/historial");
}
