import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoReinicio = { error: string | null; ok: boolean };

const ok: ResultadoReinicio = { error: null, ok: true };
function fail(mensaje: string): ResultadoReinicio {
  return { error: mensaje, ok: false };
}

/** Quién ejecutó la acción, para la nota que queda en la ficha del alumno. */
export type ActorReinicio = { userId: string; nombre: string; quien: "el entrenador" | "el alumno" };

/**
 * Reabre una sesión que quedó completada/registrada por error, para que el
 * alumno pueda corregirla. A propósito NO borra nada: ni la fila de
 * `sesiones_entrenamiento`, ni sus ejercicios/series, ni los Puntos VIP ya
 * ganados (son inmutables por diseño — ver `guardarRecompensaInmutable` en
 * `lib/ranking/movimientos.ts`). Solo vuelve el estado a `en_progreso`.
 *
 * Usado tanto por el entrenador (`admin/alumnos/actions.ts`, sobre cualquier
 * alumno) como por el propio alumno (`alumno/entrenar/actions.ts`, solo
 * sobre su propia cuenta) — cada llamador valida el permiso antes de invocar
 * esto.
 */
export async function reabrirSesionCore(
  alumnoId: string,
  sesionId: string,
  actor: ActorReinicio
): Promise<ResultadoReinicio> {
  const admin = createAdminClient();

  const { data: sesion } = await admin
    .from("sesiones_entrenamiento")
    .select("id, estado")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion) return fail("No se encontró esa sesión.");
  if (sesion.estado === "en_progreso") return fail("Esa sesión ya está en progreso, no hace falta reabrirla.");

  const { error } = await admin
    .from("sesiones_entrenamiento")
    .update({ estado: "en_progreso", hora_fin: null })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId);
  if (error) return fail("No se pudo reabrir la sesión.");

  await admin.from("notas_entrenador").insert({
    alumno_id: alumnoId,
    entrenador_id: actor.userId,
    texto: `Sesión reabierta por ${actor.quien} (${actor.nombre}): había quedado registrada/completada por error. Se puede volver a entrar a corregirla. No se borró nada del historial ni de los Puntos VIP.`,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    importante: true,
    marcar_nueva: true,
  });

  return ok;
}

/**
 * Vuelve al alumno al día 1 de su plan, como si empezara de nuevo. No borra
 * nada: la rutina anterior queda archivada (`activa: false`) con todo su
 * historial intacto, y una nota en la ficha del alumno deja constancia de
 * cuántas sesiones completó antes del reinicio.
 *
 * Usado tanto por el entrenador (`admin/alumnos/actions.ts`, sobre cualquier
 * alumno) como por el propio alumno (`alumno/entrenar/actions.ts`, solo
 * sobre su propia cuenta).
 */
export async function reiniciarPlanCore(alumnoId: string, actor: ActorReinicio): Promise<ResultadoReinicio> {
  const admin = createAdminClient();

  const { data: rutinaActual } = await admin
    .from("rutinas")
    .select("id, nombre, version")
    .eq("alumno_id", alumnoId)
    .eq("activa", true)
    .maybeSingle();
  if (!rutinaActual) return fail("No hay una rutina activa para reiniciar.");

  const { data: dias } = await admin
    .from("rutina_dias")
    .select("id, numero_dia, nombre, orden, tipo, descripcion")
    .eq("rutina_id", rutinaActual.id)
    .order("orden");
  if (!dias || dias.length === 0) return fail("No se encontraron días en la rutina activa.");

  const { data: ejercicios } = await admin
    .from("rutina_dia_ejercicios")
    .select(
      "dia_id, orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion, grupo_muscular, ejercicio_id, tecnica_series"
    )
    .in("dia_id", dias.map((d) => d.id));

  // Constancia real para la nota: cuántas sesiones completó de verdad en el
  // ciclo que se está por archivar. No se toca ni una fila de esta consulta.
  const { data: sesionesPrevias } = await admin
    .from("sesiones_entrenamiento")
    .select("estado")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaActual.id);
  const completadas = (sesionesPrevias ?? []).filter(
    (s) => s.estado === "completada" || s.estado === "finalizada_incompleta"
  ).length;

  const { data: nuevaRutina, error: errorRutina } = await admin
    .from("rutinas")
    .insert({
      alumno_id: alumnoId,
      nombre: rutinaActual.nombre,
      activa: true,
      version: (rutinaActual.version ?? 1) + 1,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (errorRutina || !nuevaRutina) return fail("No se pudo crear la nueva rutina.");

  const { data: diasCreados, error: errorDias } = await admin
    .from("rutina_dias")
    .insert(
      dias.map((d) => ({
        rutina_id: nuevaRutina.id,
        numero_dia: d.numero_dia,
        nombre: d.nombre,
        orden: d.orden,
        tipo: d.tipo,
        descripcion: d.descripcion,
      }))
    )
    .select("id, orden");
  if (errorDias || !diasCreados || diasCreados.length !== dias.length) {
    await admin.from("rutinas").delete().eq("id", nuevaRutina.id);
    return fail("No se pudieron copiar los días de la rutina.");
  }

  const idViejoAIdNuevo = new Map<string, string>(
    dias.flatMap((d) => {
      const nuevo = diasCreados.find((candidato) => candidato.orden === d.orden);
      return nuevo ? [[d.id, nuevo.id] as const] : [];
    })
  );

  if (ejercicios && ejercicios.length > 0) {
    // Cada ejercicio tiene que caer en su día nuevo correspondiente -- si
    // alguno no resuelve (no debería pasar: ya se validó que se creó un día
    // nuevo por cada uno de los viejos), se corta en vez de insertarlo bajo
    // un `dia_id` de la rutina anterior.
    const filas = ejercicios.map((e) => ({ ...e, dia_id: idViejoAIdNuevo.get(e.dia_id) }));
    if (filas.some((f) => !f.dia_id)) {
      await admin.from("rutinas").delete().eq("id", nuevaRutina.id);
      return fail("No se pudieron copiar los ejercicios de la rutina.");
    }

    const { error: errorEjercicios } = await admin.from("rutina_dia_ejercicios").insert(
      filas.map((e) => ({
        dia_id: e.dia_id as string,
        orden: e.orden,
        nombre: e.nombre,
        series_programadas: e.series_programadas,
        reps_programadas: e.reps_programadas,
        descanso_segundos: e.descanso_segundos,
        tecnica_tipo: e.tecnica_tipo,
        tecnica_instruccion: e.tecnica_instruccion,
        observacion: e.observacion,
        grupo_muscular: e.grupo_muscular,
        ejercicio_id: e.ejercicio_id,
        tecnica_series: e.tecnica_series,
      }))
    );
    if (errorEjercicios) {
      await admin.from("rutinas").delete().eq("id", nuevaRutina.id);
      return fail("No se pudieron copiar los ejercicios de la rutina.");
    }
  }

  await admin.from("rutinas").update({ activa: false }).eq("id", rutinaActual.id);

  await admin.from("notas_entrenador").insert({
    alumno_id: alumnoId,
    entrenador_id: actor.userId,
    texto: `Plan reiniciado por ${actor.quien} (${actor.nombre}). La rutina anterior ("${rutinaActual.nombre}") queda archivada, sin borrar nada, con ${completadas} sesión(es) completada(s) en su historial. Vuelve a verse el día 1 de la pantalla principal.`,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    importante: true,
    marcar_nueva: true,
  });

  return ok;
}
