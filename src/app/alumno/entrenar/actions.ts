"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";
import { requireAlumno } from "@/lib/auth";
import { hoyISO } from "@/lib/date";
import {
  abandonarEntrenamiento,
  calcularYRegistrarPuntosImpulso,
  desactivarEntrenamiento,
  eliminarMovimientosDeSesiones,
  registrarEntrenamiento,
  registrarPenalizacionDescanso,
} from "@/lib/ranking/movimientos";
import { generarYGuardarRecomendacion } from "@/lib/impulso-vip/data";
import { leerDatosCumplimiento } from "@/lib/impulso-vip/congelar";
import { resolverCumplimiento } from "@/lib/impulso-vip/motor";
import type { ReglaImpulso } from "@/lib/impulso-vip/tipos";
import type { DificultadPercibidaImpulso } from "@/lib/supabase/types";

const DIFICULTADES_VALIDAS = new Set(["muy_facil", "facil", "justo", "dificil", "fallo"]);

/** Encuentra la sesión existente de este día o la crea, y redirige ahí.
 * Compartido por `iniciarSesion` (chequea primero si hay OTRO día
 * bloqueando) y `cancelarYEmpezarOtroDia` (ya canceló ese otro día, así que
 * entra directo sin repetir el chequeo). */
async function crearOEntrarSesion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alumnoId: string,
  diaId: string,
  rutinaId: string,
  numero: number
): Promise<never> {
  const { data: existente } = await supabase
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .eq("numero_calendario", numero)
    .maybeSingle();

  if (existente) {
    redirect(`/alumno/entrenar/sesion/${existente.id}`);
  }

  const { data: sesion, error: errorSesion } = await supabase
    .from("sesiones_entrenamiento")
    .insert({ alumno_id: alumnoId, rutina_id: rutinaId, dia_id: diaId, numero_calendario: numero })
    .select("id")
    .single();

  if (errorSesion || !sesion) redirect("/alumno/entrenar");

  const { data: ejercicios } = await supabase
    .from("rutina_dia_ejercicios")
    .select("id")
    .eq("dia_id", diaId);

  if (ejercicios && ejercicios.length > 0) {
    const { data: sesionEjercicios } = await supabase
      .from("sesion_ejercicios")
      .insert(ejercicios.map((e) => ({ sesion_id: sesion.id, dia_ejercicio_id: e.id })))
      .select("id, dia_ejercicio_id");

    // La recomendación de Impulso VIP se congela acá, al crear la sesión —
    // no se recalcula después aunque el alumno reabra la sesión. Es una
    // mejora sobre el flujo de entrenar, no un requisito para poder
    // arrancar: si algo falla (incluida la migración 0043 si todavía no
    // corrió en este entorno), no debe impedir empezar a entrenar.
    if (sesionEjercicios && sesionEjercicios.length > 0) {
      await Promise.all(
        sesionEjercicios.map((se) =>
          generarYGuardarRecomendacion(supabase, {
            sesionEjercicioId: se.id,
            diaEjercicioId: se.dia_ejercicio_id,
            alumnoId,
          }).catch(() => null)
        )
      );
    }
  }

  revalidatePath("/alumno/entrenar");
  redirect(`/alumno/entrenar/sesion/${sesion.id}`);
}

export async function iniciarSesion(formData: FormData): Promise<void> {
  const diaId = String(formData.get("dia_id") || "");
  const rutinaId = String(formData.get("rutina_id") || "");
  const numero = Number(formData.get("numero_calendario") || 0);
  if (!diaId || !rutinaId || !numero) redirect("/alumno/entrenar");

  // `requireAlumno()`, no `auth.getUser()` a secas: con el entrenador en
  // "ver como alumno", el usuario autenticado sigue siendo el entrenador, y
  // esto crearía la sesión en su propia cuenta en vez de la del alumno que
  // está mirando (mismo bug ya arreglado en comer/actions.ts). Además, esa
  // vista es de solo lectura — no debe poder arrancar nada.
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");

  const supabase = await createClient();

  // Solo bloquea si hay una rutina EMPEZADA DE VERDAD (cronómetro corriendo,
  // o un día de descanso, que no tiene ese segundo paso) — una sesión creada
  // por "Ver entrenamiento" en otro día, todavía bloqueada, es solo una vista
  // previa y no debe impedir entrar a mirar/empezar este otro día.
  //
  // El calendario (CalendarioEntrenamiento.tsx) ya hace este mismo chequeo
  // ANTES de mandar el formulario, para ofrecer el modal de "tenés un
  // entrenamiento activo, ¿continuar o cancelarlo?" en vez de redirigir en
  // silencio. Este bloqueo server-side queda como red de seguridad (JS
  // desactualizado, dos pestañas, etc.), no como el camino normal.
  const { data: candidatas } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, rutina_iniciada_en, rutina_dias(tipo)")
    .eq("alumno_id", alumnoId)
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

  await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
}

/**
 * El alumno eligió, desde el modal de conflicto, cancelar el entrenamiento
 * activo de OTRO día para empezar este. Cancela igual que
 * `cancelarSesionEnCurso` (solo si sigue en_progreso y sin ejercicios
 * completados — si ya hay progreso real, no la toca) y de ahí entra directo
 * al día nuevo.
 */
export async function cancelarYEmpezarOtroDia(formData: FormData): Promise<void> {
  const sesionIdCancelar = String(formData.get("sesion_id_cancelar") || "");
  const diaId = String(formData.get("dia_id") || "");
  const rutinaId = String(formData.get("rutina_id") || "");
  const numero = Number(formData.get("numero_calendario") || 0);
  if (!sesionIdCancelar || !diaId || !rutinaId || !numero) redirect("/alumno/entrenar");

  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");

  const supabase = await createClient();

  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado")
    .eq("id", sesionIdCancelar)
    .eq("alumno_id", alumnoId)
    .maybeSingle();

  if (sesion && sesion.estado === "en_progreso") {
    const { count } = await supabase
      .from("sesion_ejercicios")
      .select("id", { count: "exact", head: true })
      .eq("sesion_id", sesionIdCancelar)
      .eq("completado", true);

    // Si mientras tanto ya cargó progreso real, no se cancela: se prioriza no
    // perder datos por sobre completar el cambio de día que pidió el modal.
    if (!count) {
      await supabase.from("sesiones_entrenamiento").delete().eq("id", sesionIdCancelar).eq("alumno_id", alumnoId);
      revalidatePath("/alumno/entrenar/historial");
    }
  }

  await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
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

/**
 * Núcleo de guardado de un ejercicio: upsert de sus series + nota +
 * dificultad + completado, y resolución de cumplimiento de Impulso VIP.
 * Aislado de `guardarSeries` para poder reusarlo tal cual desde
 * `guardarSeriesGrupo` (biseries/técnicas encadenadas, ver
 * SesionGrupoCard.tsx): dos ejercicios en la misma técnica se guardan cada
 * uno con esta misma lógica, sin duplicarla ni arriesgar que se desincronicen.
 *
 * `sufijo` namespacea los campos del formulario (ej. `peso_1` vs
 * `peso_1_b`) para que dos ejercicios puedan compartir un único <form> sin
 * que sus campos choquen entre sí.
 */
async function guardarUnEjercicio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  sufijo: string
): Promise<{ error: string | null }> {
  const sesionEjercicioId = String(formData.get(`sesion_ejercicio_id${sufijo}`) || "");
  const notaEjercicio = String(formData.get(`nota_ejercicio${sufijo}`) || "").trim();
  const dificultadRaw = String(formData.get(`dificultad_ejercicio${sufijo}`) || "");
  const dificultadPercibida: DificultadPercibidaImpulso | null = DIFICULTADES_VALIDAS.has(dificultadRaw)
    ? (dificultadRaw as DificultadPercibidaImpulso)
    : null;

  if (!sesionEjercicioId) return { error: null };

  // La cantidad de series NUNCA sale del formulario: viene de un <input
  // hidden> que cualquiera puede editar desde las herramientas de
  // desarrollador antes de enviar (por ejemplo, decir que el ejercicio
  // tenía 1 serie en vez de 4) y así marcar "completado" — con el bono de
  // 300 puntos completo — habiendo hecho una fracción real del trabajo. Se
  // relee la cantidad real asignada por el entrenador desde la base; el
  // valor del formulario queda solo como resguardo si por algún motivo la
  // fila no tiene el vínculo esperado (dato huérfano, no un caso normal).
  const { data: asignacion } = await supabase
    .from("sesion_ejercicios")
    .select("rutina_dia_ejercicios(series_programadas)")
    .eq("id", sesionEjercicioId)
    .maybeSingle();
  const seriesAsignadas = (
    asignacion?.rutina_dia_ejercicios as { series_programadas: number } | null | undefined
  )?.series_programadas;
  const cantidad = seriesAsignadas ?? Number(formData.get(`cantidad_series${sufijo}`) || 0);

  const filas = [];
  let seriesRealizadas = 0;

  for (let i = 1; i <= cantidad; i++) {
    const esPesoCorporal = formData.get(`peso_corporal_${i}${sufijo}`) === "true";
    const realizada = formData.get(`realizada_${i}${sufijo}`) === "true";
    const pesoRaw = formData.get(`peso_${i}${sufijo}`);
    const repsRaw = formData.get(`reps_${i}${sufijo}`);

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
      // Columna nueva (migración 0043): si todavía no corrió en este
      // entorno, Supabase devuelve error de columna inexistente — no debe
      // impedir guardar el resto del ejercicio (mismo criterio de
      // degradación que el resto de Impulso VIP).
      // Un guardado automático de las series puede viajar casi al mismo
      // tiempo que la respuesta del modal. Si todavía no hay respuesta, no
      // se toca esta columna: así una petición anterior nunca puede borrar
      // la respuesta de Impulso VIP que llegó después.
      ...(dificultadPercibida ? { dificultad_percibida: dificultadPercibida } : {}),
    })
    .eq("id", sesionEjercicioId);
  if (errorNota) {
    const { error: errorSinDificultad } = await supabase
      .from("sesion_ejercicios")
      .update({ nota: notaEjercicio || null, completado, completado_en: completado ? new Date().toISOString() : null })
      .eq("id", sesionEjercicioId);
    if (errorSinDificultad) return { error: "No fue posible guardar. Revisa tu conexión e intenta nuevamente." };
  }

  // Impulso VIP: solo al completar el ejercicio (no en cada guardado
  // parcial) se resuelve si cumplió, superó o no la meta congelada al
  // empezar la sesión. Es best-effort: si la recomendación no existe (motor
  // desactivado para este ejercicio, o migración 0043 sin correr todavía),
  // no hay nada que resolver y el guardado normal ya terminó bien.
  if (completado) {
    await resolverCumplimientoImpulso(supabase, sesionEjercicioId, filas).catch(() => null);
  }

  return { error: null };
}

export async function guardarSeries(
  _prevState: GuardarSeriesState,
  formData: FormData
): Promise<GuardarSeriesState> {
  const sesionId = String(formData.get("sesion_id") || "");
  const supabase = await createClient();

  const resultado = await guardarUnEjercicio(supabase, formData, "");
  if (resultado.error) return resultado;

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return { error: null };
}

/**
 * Igual que `guardarSeries`, pero para 2 o más ejercicios encadenados
 * (biserie, triserie, giant set) que comparten un único <form> — ver
 * `SesionGrupoCard.tsx`. Cada ejercicio usa sus propios campos
 * namespaceados ("" para el primero, "_1", "_2"... para el resto, ver
 * `SUFIJOS` en el componente) y se guarda con la MISMA lógica que un
 * ejercicio suelto, uno después del otro. Si alguno falla, no se intenta
 * guardar los que quedan — mejor un error claro que un guardado a medias
 * silencioso.
 */
export async function guardarSeriesGrupo(
  _prevState: GuardarSeriesState,
  formData: FormData
): Promise<GuardarSeriesState> {
  const sesionId = String(formData.get("sesion_id") || "");
  const cantidad = Number(formData.get("cantidad_ejercicios_grupo") || 0);
  const supabase = await createClient();

  for (let i = 0; i < cantidad; i++) {
    const sufijo = i === 0 ? "" : `_${i}`;
    const resultado = await guardarUnEjercicio(supabase, formData, sufijo);
    if (resultado.error) return resultado;
  }

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return { error: null };
}

/** Compara las series recién guardadas contra la recomendación congelada de
 * este ejercicio (si existe) y guarda el resultado — cumplida, superada,
 * parcial o no cumplida. Regla E nunca se evalúa (`resolverCumplimiento`
 * devuelve null), así que nunca queda con un cumplimiento asignado. */
async function resolverCumplimientoImpulso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sesionEjercicioId: string,
  filas: { numero_serie: number; peso_kg: number | null; es_peso_corporal: boolean; reps_realizadas: number | null; realizada: boolean }[]
): Promise<void> {
  const { data: recomendacion } = await supabase
    .from("impulso_vip_recomendaciones")
    .select("regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, decision_data")
    .eq("sesion_ejercicio_id", sesionEjercicioId)
    .maybeSingle();
  if (!recomendacion) return;

  const { metaTotalReps, totalAnteriorReps } = leerDatosCumplimiento(recomendacion.decision_data);
  const cumplimiento = resolverCumplimiento(
    {
      regla: recomendacion.regla as ReglaImpulso,
      pesoSugeridoKg: recomendacion.peso_sugerido_kg,
      repsObjetivoMin: recomendacion.reps_objetivo_min,
      repsObjetivoMax: recomendacion.reps_objetivo_max,
      metaTotalReps,
    },
    filas.map((f) => ({
      numeroSerie: f.numero_serie,
      pesoKg: f.peso_kg,
      esPesoCorporal: f.es_peso_corporal,
      repsRealizadas: f.reps_realizadas,
      realizada: f.realizada,
    })),
    totalAnteriorReps
  );

  await supabase
    .from("impulso_vip_recomendaciones")
    .update({ cumplimiento, resuelto_en: new Date().toISOString() })
    .eq("sesion_ejercicio_id", sesionEjercicioId);
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

  // Bono de Impulso VIP: solo si de verdad hubo metas evaluadas (ver
  // `calcularYRegistrarPuntosImpulso` — devuelve 0 en cualquier error, nunca
  // bloquea poder finalizar la sesión).
  const puntosImpulso = await calcularYRegistrarPuntosImpulso(alumnoId, sesionId, sesion.fecha);

  // Finalizar una sesión cambia los puntos de asistencia: el ranking cacheado
  // tiene que rehacerse ahora, no cuando venza solo.
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  redirect(`/alumno/entrenar?puntos=${puntos + puntosImpulso}`);
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
  revalidateTag(TAG_RANKING, { expire: 0 });
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

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
}

/**
 * Cancela una sesión en curso que se creó por error (ej. tocar "Iniciar
 * entrenamiento" en el día que no correspondía). Sin progreso real borra la
 * fila por completo; si ya hay ejercicios terminados, preserva los datos en
 * el historial como sesión abandonada y retira sus puntos. En ambos casos
 * libera el cupo de "un día en curso a la vez" de iniciarSesion().
 */
export async function cancelarSesionEnCurso(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) redirect("/alumno/entrenar");

  const supabase = await createClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado, fecha")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion || sesion.estado !== "en_progreso") redirect("/alumno/entrenar");

  const { count } = await supabase
    .from("sesion_ejercicios")
    .select("id", { count: "exact", head: true })
    .eq("sesion_id", sesionId)
    .eq("completado", true);
  if (count && count > 0) {
    // Si ya existe progreso real no se destruye: se conserva en el historial
    // como abandonado y se retiran sus puntos. La sesión deja igualmente de
    // ocupar el cupo de entrenamiento activo.
    await supabase
      .from("sesiones_entrenamiento")
      .update({ estado: "abandonada" })
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId);
    await abandonarEntrenamiento(alumnoId, sesionId, sesion.fecha);
    revalidateTag(TAG_RANKING, { expire: 0 });
  } else {
    await supabase.from("sesiones_entrenamiento").delete().eq("id", sesionId).eq("alumno_id", alumnoId);
  }

  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/inicio");
  redirect("/alumno/entrenar");
}

/**
 * Reinicia una rutina de cero: borra TODAS las sesiones (y en cascada sus
 * ejercicios y series) que el alumno haya registrado bajo esa rutina, para
 * que el calendario de Entrenar vuelva a empezar desde el Día 1.
 *
 * También borra los movimientos de puntos de esas sesiones (`entrenamiento:
 * <sesionId>` e `impulso:<sesionId>`) antes de eliminarlas: dejarlos
 * intactos (como se hacía antes) generaba puntos duplicados, porque al
 * volver a completar la rutina se crean sesiones con IDs nuevos y se suman
 * puntos nuevos encima de los viejos que quedaban huérfanos.
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

  const { data: sesiones } = await supabase
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("rutina_id", rutinaId)
    .eq("alumno_id", alumnoId);

  await eliminarMovimientosDeSesiones(
    alumnoId,
    (sesiones ?? []).map((s) => s.id)
  );

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

/**
 * Penaliza descansar de más entre series. Se llama directo desde el
 * cliente (no es un `<form>`) por un intervalo que corre mientras el
 * descanso de una serie ya terminó y el alumno no arrancó la siguiente —
 * ver el efecto de "exceso" en `SesionEjercicioCard.tsx`.
 *
 * No valida que el descanso siga corriendo de verdad server-side (sería una
 * llamada extra por tick): confía en que `tramosExcedidos` viene de un
 * `setInterval` real del cliente. El upsert por clave fija en
 * `registrarPenalizacionDescanso` limita el daño de un cliente manipulado a,
 * como mucho, `PUNTOS_VIP.descansoPenalizacionMaxima` por serie — el mismo
 * tope que tendría un alumno de buena fe.
 */
export async function penalizarExcesoDescanso(
  sesionEjercicioId: string,
  numero: number,
  tramosExcedidos: number
): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionEjercicioId || numero <= 0 || tramosExcedidos <= 0 || soloLectura) return;

  await registrarPenalizacionDescanso({
    alumnoId,
    sesionEjercicioId,
    numero,
    tramosExcedidos,
    fecha: hoyISO(),
  });
  revalidateTag(TAG_RANKING, { expire: 0 });
}
