"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { TAG_RANKING } from "@/lib/ranking/data";
import { requireAlumno } from "@/lib/auth";
import { hoyISO } from "@/lib/date";
import {
  abandonarEntrenamiento,
  calcularYRegistrarPuntosImpulso,
  registrarEntrenamiento,
  registrarPenalizacionDescanso,
  registrarTecnicaCumplida,
} from "@/lib/ranking/movimientos";
import { generarYGuardarRecomendacion } from "@/lib/impulso-vip/data";
import { asegurarIntervencionEnVivo, garantizarMomentoMinimoSesion } from "@/lib/impulso-vip/en-vivo-data";
import { entregarIndicacionesProgramadas } from "@/lib/impulso-vip/manual-data";
import { leerDatosCumplimiento } from "@/lib/impulso-vip/congelar";
import { resolverCumplimiento } from "@/lib/impulso-vip/motor";
import type { ReglaImpulso } from "@/lib/impulso-vip/tipos";
import type { DificultadPercibidaImpulso } from "@/lib/supabase/types";
import {
  estanCompletasLasSeriesAsignadas,
  leerSeriesFormulario,
  MAXIMO_SERIES_EXTRA,
  resolverCantidadSeriesRegistro,
} from "@/lib/entrenamiento/leer-series-formulario";
import { ESTADOS_CORREGIBLES, sePuedeCorregir } from "@/lib/entrenamiento/estado-sesion";
import { obtenerEstadoPlanMensual } from "@/lib/planes-entrenamiento-servidor";
import type { SupabaseClient } from "@supabase/supabase-js";

const DIFICULTADES_VALIDAS = new Set(["muy_facil", "facil", "justo", "dificil", "fallo"]);
type TrainingDb = ReturnType<typeof createAdminClient>;

/** Preferencia personal durante el entrenamiento: no cambia la rutina del
 * entrenador ni sus segundos de referencia; solo decide si el alumno quiere
 * que corra la cuenta regresiva y la regla de puntos por excederse. */
export async function actualizarTemporizadorDescansoAlumno(
  modo: "libre" | "entrenador" | 40 | 60 | 90 | 120
): Promise<{ ok: boolean; error: string | null; personalizacionTemporal?: boolean }> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes cambiar el descanso en modo solo lectura." };
  if (modo !== "libre" && modo !== "entrenador" && ![40, 60, 90, 120].includes(modo)) {
    return { ok: false, error: "La opción de descanso no es válida." };
  }
  const temporizadorActivo = modo !== "libre";
  const segundosPreferidos = typeof modo === "number" ? modo : null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("alumno_perfil")
    .update({
      temporizador_descanso: temporizadorActivo,
      temporizador_descanso_desactivado_por_alumno: !temporizadorActivo,
      segundos_descanso_preferido: segundosPreferidos,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId);

  if (error) {
    // La app puede estar apuntando a una base que todavía no recibió 0089.
    // El interruptor original (0087) sí existe: se guarda igual y la duración
    // elegida queda aplicada a esta sesión desde el cliente, en vez de mostrar
    // un error al alumno por una migración pendiente del entorno.
    const faltaColumnaNueva = error.code === "PGRST204" || /segundos_descanso_preferido|temporizador_descanso_desactivado_por_alumno/i.test(error.message);
    if (!faltaColumnaNueva) {
      console.error("[entrenar] no se pudo actualizar temporizador_descanso:", error.message);
      return { ok: false, error: "No fue posible ajustar el descanso. Intenta nuevamente." };
    }
    const { error: errorBase } = await supabase
      .from("alumno_perfil")
      .update({ temporizador_descanso: temporizadorActivo, updated_at: new Date().toISOString() })
      .eq("user_id", alumnoId);
    if (errorBase) {
      console.error("[entrenar] no se pudo guardar el temporizador base:", errorBase.message);
      return { ok: false, error: "No fue posible ajustar el descanso. Intenta nuevamente." };
    }
    // No revalidamos acá: la preferencia de segundos vive temporalmente en el
    // estado de la pantalla hasta que 0089 exista, y una revalidación la
    // desmontaría antes de que el alumno pueda usarla.
    return { ok: true, error: null, personalizacionTemporal: true };
  }

  // La ruta actual recibe el nuevo dato en la misma respuesta de la Server
  // Action: las filas cancelan un reloj que estuviera corriendo y dejan de
  // registrar descuentos si se eligió descanso libre.
  revalidatePath("/alumno/entrenar/sesion/[id]", "page");
  return { ok: true, error: null };
}

async function buscarOtraSesionRealEnProgreso(
  supabase: TrainingDb,
  alumnoId: string,
  excluirSesionId?: string
) {
  let consulta = supabase
    .from("sesiones_entrenamiento")
    .select("id, rutina_iniciada_en, rutina_dias(tipo)")
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .order("hora_inicio", { ascending: false })
    .limit(20);

  if (excluirSesionId) consulta = consulta.neq("id", excluirSesionId);

  const { data: candidatas } = await consulta;
  return (candidatas ?? []).find((sesion) => {
    const dia = sesion.rutina_dias as unknown as { tipo: string } | null;
    return dia?.tipo === "descanso" || sesion.rutina_iniciada_en !== null;
  });
}

/** Encuentra la sesión existente de este día o la crea, y redirige ahí.
 * Compartido por `iniciarSesion` (chequea primero si hay OTRO día
 * bloqueando) y `cancelarYEmpezarOtroDia` (ya canceló ese otro día, así que
 * entra directo sin repetir el chequeo). */
async function crearOEntrarSesion(
  supabase: TrainingDb,
  alumnoId: string,
  diaId: string,
  rutinaId: string,
  numero: number
): Promise<string> {
  const [{ data: rutinaPropia }, { data: diaPropio }] = await Promise.all([
    supabase.from("rutinas").select("id").eq("id", rutinaId).eq("alumno_id", alumnoId).eq("activa", true).maybeSingle(),
    supabase.from("rutina_dias").select("id, tipo").eq("id", diaId).eq("rutina_id", rutinaId).maybeSingle(),
  ]);
  if (!rutinaPropia || !diaPropio) redirect("/alumno/entrenar");

  const { data: existente } = await supabase
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .eq("numero_calendario", numero)
    .maybeSingle();

  if (existente) {
    return existente.id;
  }

  if (diaPropio.tipo === "entrenamiento") {
    const plan = await obtenerEstadoPlanMensual(supabase as unknown as SupabaseClient, alumnoId);
    if (plan?.pausado) redirect("/alumno/entrenar?plan=pausado");
    if (plan && plan.restantes <= 0) redirect("/alumno/entrenar?plan=agotado");
  }

  const inicioDescanso = diaPropio.tipo === "descanso" ? new Date().toISOString() : null;
  const { data: sesion, error: errorSesion } = await supabase
    .from("sesiones_entrenamiento")
    .insert({
      alumno_id: alumnoId,
      rutina_id: rutinaId,
      dia_id: diaId,
      numero_calendario: numero,
      rutina_iniciada_en: inicioDescanso,
    })
    .select("id")
    .single();

  if (errorSesion || !sesion) {
    // La restricción de la migración 0071 también cubre la carrera entre
    // dos pestañas: si la otra solicitud arrancó primero, se continúa esa.
    const activa = await buscarOtraSesionRealEnProgreso(supabase, alumnoId);
    if (activa) return activa.id;

    const { data: creadaPorOtraSolicitud } = await supabase
      .from("sesiones_entrenamiento")
      .select("id")
      .eq("alumno_id", alumnoId)
      .eq("rutina_id", rutinaId)
      .eq("numero_calendario", numero)
      .maybeSingle();
    if (creadaPorOtraSolicitud) return creadaPorOtraSolicitud.id;
    redirect("/alumno/entrenar");
  }

  // El objetivo del alumno va en el mismo viaje que los ejercicios: no
  // depende de ellos y así no cuesta nada. Se lee UNA vez y se le pasa a
  // todas las recomendaciones — antes cada ejercicio pedía la misma fila de
  // `alumno_perfil` por su cuenta, o sea diez consultas idénticas para una
  // rutina de diez, todas dentro de la espera que el alumno ve al tocar "Ver
  // entrenamiento".
  const [{ data: ejercicios }, { data: perfilAlumno }] = await Promise.all([
    supabase
      .from("rutina_dia_ejercicios")
      .select("id, orden, series_programadas, tecnica_tipo")
      .eq("dia_id", diaId)
      .order("orden"),
    supabase.from("alumno_perfil").select("objetivo").eq("user_id", alumnoId).maybeSingle(),
  ]);

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
        sesionEjercicios.map(async (se) => {
          try {
          await generarYGuardarRecomendacion(supabase, {
            sesionEjercicioId: se.id,
            diaEjercicioId: se.dia_ejercicio_id,
            alumnoId,
            objetivoAlumno: { valor: perfilAlumno?.objetivo ?? null },
            // Los ejercicios se acaban de insertar acá arriba: no puede haber
            // una recomendación previa que buscar.
            sesionRecienCreada: true,
          });
          } catch {
            // Impulso mejora la sesion, pero una migracion pendiente nunca
            // puede impedir que el alumno empiece a entrenar.
          }
        })
      );
      // En orden y no en Promise.all: el limite de tres ejercicios
      // destacados por sesion debe ser determinista, no depender de cual
      // consulta gana una carrera.
      const ordenPorAsignacion = new Map(ejercicios.map((e) => [e.id, e.orden]));
      const ordenados = [...sesionEjercicios].sort(
        (a, b) => (ordenPorAsignacion.get(a.dia_ejercicio_id) ?? 0) - (ordenPorAsignacion.get(b.dia_ejercicio_id) ?? 0)
      );
      // Las indicaciones personales ocupan primero su serie. Después el
      // motor automático completa únicamente los momentos que siguen libres.
      await entregarIndicacionesProgramadas(supabase, {
        alumnoId,
        sesionEjercicios: ordenados,
      }).catch(() => null);
      for (const se of ordenados) {
        await asegurarIntervencionEnVivo(supabase, {
          sesionEjercicioId: se.id,
          alumnoId,
        }).catch(() => null);
      }
      // Si con las reglas normales ningún ejercicio del día terminó con un
      // momento Impulso VIP, y el alumno ya tiene historial de sobra, se
      // garantiza uno igual — ver el comentario de la función.
      const datosPorAsignacion = new Map(
        ejercicios.map((e) => [e.id, { seriesProgramadas: e.series_programadas, tecnicaTipo: e.tecnica_tipo }])
      );
      await garantizarMomentoMinimoSesion(supabase, {
        alumnoId,
        sesionId: sesion.id,
        sesionEjercicios: ordenados.map((se) => ({
          id: se.id,
          seriesProgramadas: datosPorAsignacion.get(se.dia_ejercicio_id)?.seriesProgramadas ?? 0,
          tecnicaTipo: datosPorAsignacion.get(se.dia_ejercicio_id)?.tecnicaTipo ?? null,
        })),
      }).catch(() => null);
    }
  }

  revalidatePath("/alumno/entrenar");
  return sesion.id;
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

  const supabase = createAdminClient();

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
  const enProgreso = await buscarOtraSesionRealEnProgreso(supabase, alumnoId);

  if (enProgreso) {
    redirect(`/alumno/entrenar/sesion/${enProgreso.id}`);
  }

  const sesionId = await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
  redirect(`/alumno/entrenar/sesion/${sesionId}`);
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
  const iniciarAhora = String(formData.get("iniciar_ahora") || "") === "true";
  if (!sesionIdCancelar || !diaId || !rutinaId || !numero) redirect("/alumno/entrenar");

  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");

  const supabase = createAdminClient();

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
    } else {
      // El progreso apareció después de abrir el modal. No se crea otra
      // sesión: se conserva y continúa la que ya contiene trabajo real.
      redirect(`/alumno/entrenar/sesion/${sesionIdCancelar}`);
    }
  }

  const sesionId = await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
  if (iniciarAhora) {
    const plan = await obtenerEstadoPlanMensual(supabase as unknown as SupabaseClient, alumnoId);
    if (plan?.pausado || (plan && plan.restantes <= 0)) {
      redirect(`/alumno/entrenar?plan=${plan.pausado ? "pausado" : "agotado"}`);
    }

    const { error } = await supabase.from("sesiones_entrenamiento")
      .update({ rutina_iniciada_en: new Date().toISOString() })
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId)
      .eq("estado", "en_progreso")
      .is("rutina_iniciada_en", null);

    if (!error) {
      const { data: ejerciciosSesion } = await supabase.from("sesion_ejercicios")
        .select("id, dia_ejercicio_id").eq("sesion_id", sesionId);
      await entregarIndicacionesProgramadas(supabase, {
        alumnoId,
        sesionEjercicios: ejerciciosSesion ?? [],
      }).catch(() => null);
    }
  }
  revalidatePath("/alumno/entrenar");
  redirect(`/alumno/entrenar/sesion/${sesionId}`);
}

/** Desde la portada unificada: crea la sesión, arranca el cronómetro y abre
 * directamente el registro de series. El alumno ya vio todos los ejercicios
 * en la misma pantalla, así que no existe una vista previa intermedia. */
export async function iniciarRutinaDesdeCalendario(formData: FormData): Promise<void> {
  const diaId = String(formData.get("dia_id") || "");
  const rutinaId = String(formData.get("rutina_id") || "");
  const numero = Number(formData.get("numero_calendario") || 0);
  if (!diaId || !rutinaId || !numero) redirect("/alumno/entrenar");

  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");
  const supabase = createAdminClient();
  const activa = await buscarOtraSesionRealEnProgreso(supabase, alumnoId);
  if (activa) redirect(`/alumno/entrenar/sesion/${activa.id}`);

  const sesionId = await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
  const plan = await obtenerEstadoPlanMensual(supabase as unknown as SupabaseClient, alumnoId);
  if (plan?.pausado || (plan && plan.restantes <= 0)) {
    redirect(`/alumno/entrenar?plan=${plan.pausado ? "pausado" : "agotado"}`);
  }

  const { error } = await supabase.from("sesiones_entrenamiento")
    .update({ rutina_iniciada_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .is("rutina_iniciada_en", null);
  if (error) redirect(`/alumno/entrenar/sesion/${sesionId}`);

  const { data: ejerciciosSesion } = await supabase.from("sesion_ejercicios")
    .select("id, dia_ejercicio_id").eq("sesion_id", sesionId);
  await entregarIndicacionesProgramadas(supabase, {
    alumnoId,
    sesionEjercicios: ejerciciosSesion ?? [],
  }).catch(() => null);
  revalidatePath("/alumno/entrenar");
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  redirect(`/alumno/entrenar/sesion/${sesionId}`);
}

/** Mismo motor transaccional del portal original, con continuidad visual V2. */
export async function iniciarRutinaDesdeCalendarioV2(formData: FormData): Promise<void> {
  const diaId = String(formData.get("dia_id") || "");
  const rutinaId = String(formData.get("rutina_id") || "");
  const numero = Number(formData.get("numero_calendario") || 0);
  if (!diaId || !rutinaId || !numero) redirect("/portal-v2/entrenamiento");

  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/portal-v2/entrenamiento");
  const supabase = createAdminClient();
  const activa = await buscarOtraSesionRealEnProgreso(supabase, alumnoId);
  if (activa) redirect(`/portal-v2/entrenamiento/sesion?id=${activa.id}`);

  const sesionId = await crearOEntrarSesion(supabase, alumnoId, diaId, rutinaId, numero);
  const plan = await obtenerEstadoPlanMensual(supabase as unknown as SupabaseClient, alumnoId);
  if (plan?.pausado || (plan && plan.restantes <= 0)) {
    redirect(`/portal-v2/entrenamiento?plan=${plan.pausado ? "pausado" : "agotado"}`);
  }

  const { error } = await supabase.from("sesiones_entrenamiento")
    .update({ rutina_iniciada_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .is("rutina_iniciada_en", null);
  if (error) redirect(`/portal-v2/entrenamiento/sesion?id=${sesionId}`);

  const { data: ejerciciosSesion } = await supabase.from("sesion_ejercicios")
    .select("id, dia_ejercicio_id").eq("sesion_id", sesionId);
  await entregarIndicacionesProgramadas(supabase, {
    alumnoId,
    sesionEjercicios: ejerciciosSesion ?? [],
  }).catch(() => null);
  revalidatePath("/portal-v2/entrenamiento");
  revalidatePath("/portal-v2/entrenamiento/sesion");
  redirect(`/portal-v2/entrenamiento/sesion?id=${sesionId}`);
}

/** Núcleo compartido de "arrancar el cronómetro" de una sesión ya creada:
 * chequea el plan, marca `rutina_iniciada_en` y dispara las indicaciones de
 * Impulso VIP. Usado por `iniciarRutina` (camino normal, sin conflicto) y por
 * `cancelarOtraYIniciarRutina` (después de resolver el conflicto con otra
 * sesión activa) — mismo final para los dos caminos. */
async function marcarRutinaIniciada(supabase: TrainingDb, alumnoId: string, sesionId: string): Promise<void> {
  const plan = await obtenerEstadoPlanMensual(supabase as unknown as SupabaseClient, alumnoId);
  if (plan?.pausado || (plan && plan.restantes <= 0)) {
    redirect(`/alumno/entrenar?plan=${plan.pausado ? "pausado" : "agotado"}`);
  }

  const { error } = await supabase
    .from("sesiones_entrenamiento")
    .update({ rutina_iniciada_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .is("rutina_iniciada_en", null);

  if (error) {
    // Si dos pestañas pasaron el chequeo a la vez, el índice único deja
    // ganar solo a una. En vez de mostrar un error, se abre la ganadora.
    const ganadora = await buscarOtraSesionRealEnProgreso(supabase, alumnoId, sesionId);
    if (ganadora) redirect(`/alumno/entrenar/sesion/${ganadora.id}`);
    redirect("/alumno/entrenar");
  }

  const { data: ejerciciosSesion } = await supabase.from("sesion_ejercicios")
    .select("id, dia_ejercicio_id").eq("sesion_id", sesionId);
  await entregarIndicacionesProgramadas(supabase, {
    alumnoId,
    sesionEjercicios: ejerciciosSesion ?? [],
  }).catch(() => null);

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
}

/** El alumno ya está en la pantalla de la sesión pero la rutina sigue
 * bloqueada (ver migración 0040): esto la desbloquea y ancla el cronómetro.
 * `is(...null)` la hace idempotente — un doble tap no corre el reloj de
 * nuevo. */
export async function iniciarRutina(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return;

  const supabase = createAdminClient();
  // Red de seguridad server-side (ver el mismo comentario en `iniciarSesion`):
  // el camino normal ya pregunta antes, en el cliente (BotonIniciarRutinaFijo,
  // con el conflicto que le pasa sesion/[id]/page.tsx vía
  // `obtenerConflictoSesionActiva`). Esto solo cubre JS desactualizado o dos
  // pestañas — ahí sí toca redirigir en silencio, ya no hay vuelta atrás.
  const otraActiva = await buscarOtraSesionRealEnProgreso(supabase, alumnoId, sesionId);
  if (otraActiva) redirect(`/alumno/entrenar/sesion/${otraActiva.id}`);

  await marcarRutinaIniciada(supabase, alumnoId, sesionId);
}

/**
 * El alumno confirmó — DOS veces, ver el modal en `BotonIniciarRutinaFijo` —
 * que quiere abandonar otra sesión activa para arrancar esta, que ya existe
 * como vista previa bloqueada. Mismo criterio de "no perder progreso real"
 * que `cancelarYEmpezarOtroDia`: si esa otra sesión ya tiene series
 * completadas, no se cancela — `marcarRutinaIniciada` la vuelve a detectar y
 * redirige ahí en vez de arrancar esta con la otra todavía viva.
 */
export async function cancelarOtraYIniciarRutina(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const sesionIdCancelar = String(formData.get("sesion_id_cancelar") || "");
  if (!sesionId || !sesionIdCancelar) redirect("/alumno/entrenar");

  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect("/alumno/entrenar");
  const supabase = createAdminClient();

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

    if (!count) {
      await supabase.from("sesiones_entrenamiento").delete().eq("id", sesionIdCancelar).eq("alumno_id", alumnoId);
      revalidatePath("/alumno/entrenar/historial");
    }
  }

  const otraActiva = await buscarOtraSesionRealEnProgreso(supabase, alumnoId, sesionId);
  if (otraActiva) redirect(`/alumno/entrenar/sesion/${otraActiva.id}`);

  await marcarRutinaIniciada(supabase, alumnoId, sesionId);
  revalidatePath("/alumno/entrenar");
}

export type GuardarSeriesState = { error: string | null };

export type SerieRegistroV2 = {
  reps: string;
  peso: string;
  completada: boolean;
};

export type EjercicioRegistroV2 = {
  sesionEjercicioId: string;
  nota?: string;
  series: SerieRegistroV2[];
};

export type RegistroSesionV2 = {
  sesionId: string;
  ejercicios: EjercicioRegistroV2[];
  comentario?: string;
};

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
  supabase: TrainingDb,
  formData: FormData,
  sufijo: string,
  sesionId: string,
  alumnoId: string
): Promise<{ error: string | null; completado?: boolean; sesionEjercicioId?: string }> {
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
    .select("rutina_dia_ejercicios(series_programadas, tecnica_tipo)")
    .eq("id", sesionEjercicioId)
    .eq("sesion_id", sesionId)
    .maybeSingle();
  if (!asignacion) return { error: "El ejercicio no pertenece a esta sesión." };
  const seriesAsignadas = (
    asignacion?.rutina_dia_ejercicios as { series_programadas: number; tecnica_tipo: string | null } | null | undefined
  )?.series_programadas;
  const tecnicaTipo = (
    asignacion?.rutina_dia_ejercicios as { series_programadas: number; tecnica_tipo: string | null } | null | undefined
  )?.tecnica_tipo;
  const cantidadAsignada = seriesAsignadas ?? Number(formData.get(`cantidad_series${sufijo}`) || 0);
  // Una serie extra es una decisión del alumno durante el entrenamiento, no
  // una modificación silenciosa de la rutina del entrenador. Se aceptan como
  // máximo tres y solo cuando el formulario lo declara expresamente. Las
  // extras se guardan, pero nunca se usan para decidir si cumplió lo pautado.
  const pideExtras = formData.get(`permitir_series_extra${sufijo}`) === "true";
  const cantidadSolicitada = Number(formData.get(`cantidad_series_registradas${sufijo}`) || cantidadAsignada);
  const cantidadRegistro = resolverCantidadSeriesRegistro(
    cantidadAsignada,
    cantidadSolicitada,
    pideExtras
  );

  const leidas = leerSeriesFormulario(formData, sesionEjercicioId, cantidadRegistro, sufijo);
  if (!leidas.ok) return { error: leidas.error };
  const { filas } = leidas;

  if (filas.length > 0) {
    const { error } = await supabase
      .from("series_realizadas")
      .upsert(filas, { onConflict: "sesion_ejercicio_id,numero_serie" });
    if (error) return { error: "No fue posible guardar las series. Revisa tu conexión e intenta nuevamente." };
  }
  if (pideExtras) {
    // Si quitó una extra que había llegado a guardarse (por ejemplo la marcó,
    // la deshizo y luego tocó "Quitar extra"), no debe reaparecer al recargar.
    await supabase
      .from("series_realizadas")
      .delete()
      .eq("sesion_ejercicio_id", sesionEjercicioId)
      .gt("numero_serie", cantidadRegistro)
      .lte("numero_serie", cantidadAsignada + MAXIMO_SERIES_EXTRA);
  }

  // El ejercicio solo cuenta como realizado si TODAS sus series están
  // marcadas como hechas — cargar un peso/reps por sí solo no alcanza, y
  // dejar algunas sin marcar significa que quedó incompleto.
  // Confirmamos contra las filas persistidas, no solo contra los campos que
  // estaban montados en pantalla. En una superserie la ronda anterior puede
  // estar oculta al guardar la siguiente, pero nunca debe perder su progreso.
  const { data: filasPersistidas, error: errorLecturaSeries } = await supabase
    .from("series_realizadas")
    .select("sesion_ejercicio_id, numero_serie, peso_kg, es_peso_corporal, reps_realizadas, rir_estimado, realizada")
    .eq("sesion_ejercicio_id", sesionEjercicioId);
  if (errorLecturaSeries) return { error: "No fue posible confirmar las series guardadas. Intenta nuevamente." };
  const seriesGuardadas = filasPersistidas ?? [];
  const completado = estanCompletasLasSeriesAsignadas(seriesGuardadas, cantidadAsignada);
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

  // Técnica de entrenamiento asignada (drop set, rest-pause, biserie,
  // triserie...) cumplida con esfuerzo real: solo "Estuvo muy difícil"
  // cuenta — "No pude completarla" es una alerta, no un logro. Nunca debe
  // impedir guardar el resto del ejercicio si falla.
  if (dificultadPercibida === "dificil" && tecnicaTipo?.trim()) {
    await registrarTecnicaCumplida({
      alumnoId,
      sesionEjercicioId,
      fecha: hoyISO(),
      tecnicaTipo,
    }).catch(() => null);
  }

  // Impulso VIP: solo al completar el ejercicio (no en cada guardado
  // parcial) se resuelve si cumplió, superó o no la meta congelada al
  // empezar la sesión. Es best-effort: si la recomendación no existe (motor
  // desactivado para este ejercicio, o migración 0043 sin correr todavía),
  // no hay nada que resolver y el guardado normal ya terminó bien.
  if (completado) {
    await resolverCumplimientoImpulso(supabase, sesionEjercicioId, seriesGuardadas).catch(() => null);
  }

  return { error: null, completado, sesionEjercicioId };
}

/**
 * ¿Se puede escribir en esta sesión? Sí mientras el alumno entrena, y también
 * si abrió una corrección sobre un registro ya cerrado (migración 0077).
 *
 * Con respaldo por la misma razón que `obtenerSesionCompleta`: si la 0077
 * todavía no corrió, `corrigiendo_desde` no existe y la consulta falla
 * ENTERA. Sin este respaldo el alumno no podía guardar nada —ni siquiera
 * entrenando normal— porque el chequeo previo a escribir reventaba antes de
 * llegar a los datos.
 */
async function sesionAceptaEscritura(
  supabase: TrainingDb,
  sesionId: string,
  alumnoId: string
): Promise<boolean> {
  const conCorreccion = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado, corrigiendo_desde")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();

  if (!conCorreccion.error) {
    const sesion = conCorreccion.data;
    return !!sesion && (sesion.estado === "en_progreso" || sesion.corrigiendo_desde !== null);
  }

  // Sin la 0077 no hay correcciones posibles, así que vale la regla de
  // siempre: se escribe solo mientras la sesión está en progreso.
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  return data?.estado === "en_progreso";
}

export async function guardarSeries(
  _prevState: GuardarSeriesState,
  formData: FormData
): Promise<GuardarSeriesState> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return { error: "Esta sesión ya no se puede editar." };
  const supabase = createAdminClient();
  if (!(await sesionAceptaEscritura(supabase, sesionId, alumnoId))) {
    return { error: "La sesión ya fue cerrada. No se sobrescribió ningún registro." };
  }

  const resultado = await guardarUnEjercicio(supabase, formData, "", sesionId, alumnoId);
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
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return { error: "Esta sesión ya no se puede editar." };
  const supabase = createAdminClient();
  if (!(await sesionAceptaEscritura(supabase, sesionId, alumnoId))) {
    return { error: "La sesión ya fue cerrada. No se sobrescribió ningún registro." };
  }

  for (let i = 0; i < cantidad; i++) {
    const sufijo = i === 0 ? "" : `_${i}`;
    const resultado = await guardarUnEjercicio(supabase, formData, sufijo, sesionId, alumnoId);
    if (resultado.error) return resultado;
  }

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return { error: null };
}

/**
 * Adaptador seguro de la experiencia V2 al motor probado del portal original.
 * El cliente solo describe lo que ve; `guardarUnEjercicio` vuelve a validar
 * pertenencia, cantidad asignada, límites y estado de la sesión en servidor.
 */
export async function guardarSesionV2(registro: RegistroSesionV2): Promise<GuardarSeriesState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!registro.sesionId || soloLectura) return { error: "Esta sesión ya no se puede editar." };
  if (!Array.isArray(registro.ejercicios) || registro.ejercicios.length > 80) {
    return { error: "El registro de la sesión no es válido." };
  }

  const supabase = createAdminClient();
  if (!(await sesionAceptaEscritura(supabase, registro.sesionId, alumnoId))) {
    return { error: "La sesión ya fue cerrada. No se sobrescribió ningún registro." };
  }

  for (const ejercicio of registro.ejercicios) {
    if (!ejercicio.sesionEjercicioId || !Array.isArray(ejercicio.series) || ejercicio.series.length > 50) {
      return { error: "Uno de los ejercicios contiene datos no válidos." };
    }
    const formData = new FormData();
    formData.set("sesion_ejercicio_id", ejercicio.sesionEjercicioId);
    formData.set("cantidad_series", String(ejercicio.series.length));
    formData.set("cantidad_series_registradas", String(ejercicio.series.length));
    formData.set("nota_ejercicio", ejercicio.nota ?? "");
    ejercicio.series.forEach((serie, indice) => {
      const numero = indice + 1;
      formData.set(`reps_${numero}`, serie.reps);
      formData.set(`peso_${numero}`, serie.peso);
      formData.set(`realizada_${numero}`, String(serie.completada));
    });
    const resultado = await guardarUnEjercicio(supabase, formData, "", registro.sesionId, alumnoId);
    if (resultado.error) return { error: resultado.error };
  }

  revalidatePath("/portal-v2/entrenamiento/sesion");
  revalidatePath("/portal-v2/entrenamiento");
  revalidatePath(`/alumno/entrenar/sesion/${registro.sesionId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return { error: null };
}

export async function guardarYFinalizarSesionV2(registro: RegistroSesionV2): Promise<GuardarSeriesState> {
  if ((registro.comentario?.length ?? 0) > 1_000) {
    return { error: "La nota de la sesión no puede superar 1.000 caracteres." };
  }
  const guardado = await guardarSesionV2(registro);
  if (guardado.error) return guardado;
  const formData = new FormData();
  formData.set("sesion_id", registro.sesionId);
  formData.set("comentario", registro.comentario ?? "");
  formData.set("origen_v2", "true");
  await finalizarSesion(formData);
  return { error: null };
}

/** Compara las series recién guardadas contra la recomendación congelada de
 * este ejercicio (si existe) y guarda el resultado — cumplida, superada,
 * parcial o no cumplida. Regla E nunca se evalúa (`resolverCumplimiento`
 * devuelve null), así que nunca queda con un cumplimiento asignado. */
async function resolverCumplimientoImpulso(
  supabase: TrainingDb,
  sesionEjercicioId: string,
  filas: { numero_serie: number; peso_kg: number | null; es_peso_corporal: boolean; reps_realizadas: number | null; realizada: boolean }[]
): Promise<void> {
  const { data: recomendacion } = await supabase
    .from("impulso_vip_recomendaciones")
    .select("regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, decision_data")
    .eq("sesion_ejercicio_id", sesionEjercicioId)
    .maybeSingle();
  if (!recomendacion) return;

  const { metaTotalReps, totalAnteriorReps, seriesConsideradas } = leerDatosCumplimiento(
    recomendacion.decision_data
  );
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
    totalAnteriorReps,
    // Ya viene congelado en la recomendación: no hace falta releer la rutina
    // para saber qué series contaban, y si el entrenador la cambió en el
    // medio se evalúa contra lo que el alumno vio, no contra lo nuevo.
    seriesConsideradas
  );

  await supabase
    .from("impulso_vip_recomendaciones")
    .update({ cumplimiento, resuelto_en: new Date().toISOString() })
    .eq("sesion_ejercicio_id", sesionEjercicioId);
}

export async function finalizarSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const comentario = String(formData.get("comentario") || "").trim();
  const origenV2 = formData.get("origen_v2") === "true";
  const rutaEntrenamiento = origenV2 ? "/portal-v2/entrenamiento" : "/alumno/entrenar";
  const rutaSesion = origenV2
    ? `/portal-v2/entrenamiento/sesion?id=${sesionId}`
    : `/alumno/entrenar/sesion/${sesionId}`;
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) redirect(rutaEntrenamiento);

  const supabase = createAdminClient();
  const [{ data: sesion }, { data: ejercicios }, { data: alumnoPerfil }] = await Promise.all([
    supabase
      .from("sesiones_entrenamiento")
      .select("id, fecha, estado, rutina_iniciada_en")
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId)
      .maybeSingle(),
    supabase.from("sesion_ejercicios").select("completado").eq("sesion_id", sesionId),
    supabase
      .from("alumno_perfil")
      .select("temporizador_descanso_desactivado_por_alumno")
      .eq("user_id", alumnoId)
      .maybeSingle(),
  ]);
  if (!sesion) redirect(rutaEntrenamiento);
  if (sesion.estado !== "en_progreso") redirect(rutaSesion);

  const total = ejercicios?.length ?? 0;
  const completados = ejercicios?.filter((e) => e.completado).length ?? 0;
  // Una sesión con ejercicios solo puede cerrar y puntuar si pasó por la
  // acción «Iniciar rutina». Evita fabricar una sesión terminada llamando
  // directamente a esta Server Action.
  if (total > 0 && !sesion.rutina_iniciada_en) {
    redirect(origenV2 ? `${rutaSesion}&aviso=debes-iniciar` : `${rutaSesion}?aviso=debes-iniciar`);
  }
  // total === 0 pasa en días de descanso (sin ejercicios) — cuentan como completados.
  const estado = completados === total ? "completada" : "finalizada_incompleta";

  const { data: sesionCerrada } = await supabase
    .from("sesiones_entrenamiento")
    .update({ estado, hora_fin: new Date().toISOString(), comentario: comentario || null })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .select("id")
    .maybeSingle();

  // Cierre atómico: si otra petición ya la finalizó, no se vuelve a ejecutar
  // ninguna lógica de recompensas ni se muestra un premio inexistente.
  if (!sesionCerrada) redirect(rutaSesion);

  const puntos = await registrarEntrenamiento({
    alumnoId,
    sesionId,
    fecha: sesion.fecha,
    completados,
    total,
    descansoDesactivadoPorAlumno: alumnoPerfil?.temporizador_descanso_desactivado_por_alumno === true,
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
  redirect(`${rutaEntrenamiento}?puntos=${puntos + puntosImpulso}`);
}

/**
 * Abre un registro ya cerrado para editar los números. **No vuelve a
 * entrenar.**
 *
 * Antes esto ponía la sesión en `en_progreso`, y el efecto no era corregir:
 * era arrancar la rutina de nuevo. La sesión pasaba a ser la activa del alumno
 * (bloqueando cualquier otra), volvía el cronómetro, el aviso al salir y el
 * "Entrenamiento en curso" de arriba. Alejandro: "corregir registro inicia
 * nuevamente la rutina, y no es la idea, es corregir el registro. Y si lo
 * quiero hacer de nuevo, le pido al entrenador que lo borre y la hago de
 * nuevo".
 *
 * Ahora la sesión **se queda cerrada** y solo se marca `corrigiendo_desde`
 * (migración 0077). Consecuencias, todas buscadas: no ocupa el cupo de sesión
 * activa —así que se puede corregir aunque haya otra en curso—, no corre
 * ningún reloj, no toca los puntos ni el cupo del mes.
 */
export async function reabrirSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const confirmada = String(formData.get("confirmar_reapertura") || "") === "true";
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !confirmada) return;

  const supabase = createAdminClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("estado")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sePuedeCorregir(sesion?.estado)) return;

  const { error } = await supabase
    .from("sesiones_entrenamiento")
    .update({ corrigiendo_desde: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .in("estado", [...ESTADOS_CORREGIBLES]);

  // Si la 0077 no corrió, la columna no existe y esto falla. Antes se ignoraba
  // el error y el alumno se quedaba mirando la misma pantalla sin entender por
  // qué — el mismo "botón pegado" de siempre. Ahora al menos se lo dice.
  if (error) redirect(`/alumno/entrenar/sesion/${sesionId}?aviso=falta-migracion`);

  /**
   * La constancia de que este registro se revisó a mano, en un update aparte y
   * a propósito.
   *
   * Va sola y después de la de arriba porque es de otra migración (0078): si
   * viajara en el mismo update, un entorno sin esa columna haría fallar
   * TAMBIÉN el `corrigiendo_desde` y corregir dejaría de funcionar del todo.
   * Es exactamente cómo se rompió "Iniciar rutina" en el 1.21 — dos
   * migraciones distintas metidas en la misma consulta.
   *
   * `is null` para quedarse con la primera vez, y sin mirar el error: que no
   * exista la columna solo significa que esta sesión no va a contar todavía
   * para Impulso VIP, no que la corrección haya fallado.
   */
  await supabase
    .from("sesiones_entrenamiento")
    .update({ corregida_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .is("corregida_en", null);

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/entrenar/historial");
}

/** Cierra la corrección: la sesión vuelve a ser de solo lectura. Nunca cambió
 * de estado, así que acá no hay nada que recalcular — ni puntos, ni cupo. */
export async function terminarCorreccion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) return;

  const supabase = createAdminClient();
  await supabase
    .from("sesiones_entrenamiento")
    .update({ corrigiendo_desde: null })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId);

  /**
   * La marca también se deja acá, no solo al abrir la corrección.
   *
   * `reabrirSesion` la escribe al entrar, pero eso no cubre a quien YA estaba
   * corrigiendo cuando la 0078 llegó a la base: su corrección se abrió cuando
   * la columna no existía, y como el botón "Corregir registro" no se ofrece
   * mientras se corrige, no había forma de volver a pasar por ahí sin cerrar y
   * reabrir. Terminar de corregir es, además, el momento que mejor describe lo
   * que la marca dice: los números se revisaron a mano.
   *
   * Va en un update aparte y sin mirar el error, por lo mismo de siempre: si
   * la 0078 no corrió, cerrar la corrección tiene que seguir funcionando igual.
   */
  await supabase
    .from("sesiones_entrenamiento")
    .update({ corregida_en: new Date().toISOString() })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .is("corregida_en", null);

  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/entrenar/historial");
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

  const supabase = createAdminClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("fecha")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion) return;

  await supabase
    .from("sesiones_entrenamiento")
    .update({ estado: "abandonada" })
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId);

  // Sin esto los puntos quedaban puestos: la función decía en su propio
  // comentario que "le quita los puntos que había sumado" y nunca los quitaba
  // — `abandonarEntrenamiento` no la llamaba nadie. El alumno abandonaba la
  // sesión, la veía marcada como abandonada en el historial y seguía
  // cobrándola en el ranking.
  await abandonarEntrenamiento(alumnoId, sesionId, sesion.fecha);

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
}

/**
 * El alumno PIDE que le borren un registro. No lo borra él.
 *
 * El caso es real: "la persona llegue y haga la rutina y la marque hecha sin
 * querer" — corregir no alcanza, porque por más que edite el registro sigue
 * existiendo y contando. Pero borrar destruye historial sin vuelta atrás, y
 * dejarlo a un toque de distancia era demasiado: "si no, cualquiera puede
 * borrarla como si nada" (Alejandro).
 *
 * Se evaluó pedir un código del entrenador y se descartó — un código fijo se
 * filtra solo, y uno de un solo uso obliga al entrenador a estar disponible en
 * el momento. Queda el pedido: el entrenador lo ve en su panel y borra él.
 *
 * Se guarda una foto del día y la fecha porque, una vez borrada la sesión, la
 * solicitud es lo único que queda para saber qué se borró.
 */
export async function solicitarBorradoSesion(formData: FormData): Promise<void> {
  const sesionId = String(formData.get("sesion_id") || "");
  const motivo = String(formData.get("motivo") || "").trim().slice(0, 500);
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura || motivo.length === 0) return;

  const supabase = createAdminClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado, fecha, numero_calendario, rutina_dias(nombre)")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  // Una sesión en curso no se pide borrar: para eso está
  // `cancelarSesionEnCurso`, que además libera el cupo de sesión activa.
  if (!sesion || sesion.estado === "en_progreso") return;

  const dia = sesion.rutina_dias as unknown as { nombre: string } | null;

  /**
   * Un pedido pendiente para esta sesión ya alcanza: el segundo no se inserta.
   *
   * Acá el comentario decía "upsert" y el código hacía `insert`. El índice
   * único de la 0076 (una pendiente por sesión) rechazaba el segundo pedido, y
   * como cualquier error se traducía a `falta-migracion`, el alumno que pedía
   * dos veces —lo más natural del mundo si no ve confirmación— terminaba
   * leyendo "Esta opción todavía no está activa. Avísale a tu entrenador".
   * Mentira por partida doble: la función estaba activa y su pedido ya estaba
   * guardado. Salía a reportar una falla que no existía.
   *
   * El motivo NO se reescribe: la solicitud es la única constancia de que se
   * destruyó historial, y el tipo de la tabla ya deja `motivo` fuera de lo
   * actualizable a propósito. Si quedó mal escrito, el entrenador rechaza y el
   * alumno pide de nuevo.
   *
   * Tampoco sirve `upsert`: el índice es parcial (`where estado =
   * 'pendiente'`) y PostgREST no manda el predicado que Postgres pide para
   * usarlo en un `on conflict`.
   */
  const pendiente = await supabase
    .from("solicitudes_borrado_sesion")
    .select("id")
    .eq("sesion_id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente")
    .maybeSingle();

  // Sin la 0076 la tabla no existe. Decirlo es mejor que dejar al alumno
  // creyendo que su pedido llegó. Es el ÚNICO camino que muestra ese aviso:
  // antes lo disparaba también un pedido repetido, que no tiene nada que ver.
  if (pendiente.error) redirect(`/alumno/entrenar/sesion/${sesionId}?aviso=falta-migracion`);

  if (pendiente.data) redirect(`/alumno/entrenar/sesion/${sesionId}?aviso=pedido-en-curso`);

  const { error } = await supabase.from("solicitudes_borrado_sesion").insert({
    alumno_id: alumnoId,
    sesion_id: sesionId,
    dia_nombre: dia?.nombre ?? "Entrenamiento",
    fecha_sesion: sesion.fecha,
    numero_calendario: sesion.numero_calendario,
    motivo,
  });

  if (error) redirect(`/alumno/entrenar/sesion/${sesionId}?aviso=falta-migracion`);

  // Sin esto, el aviso verde aparecía pero el bloque de opciones seguía
  // mostrando el estado viejo hasta la próxima navegación.
  revalidatePath(`/alumno/entrenar/sesion/${sesionId}`);
  redirect(`/alumno/entrenar/sesion/${sesionId}?aviso=pedido-enviado`);
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
  const origenV2 = formData.get("origen_v2") === "true";
  const rutaEntrenamiento = origenV2 ? "/portal-v2/entrenamiento" : "/alumno/entrenar";
  const { alumnoId, soloLectura } = await requireAlumno();
  if (!sesionId || soloLectura) redirect(rutaEntrenamiento);

  const supabase = createAdminClient();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, estado, fecha")
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  if (!sesion || sesion.estado !== "en_progreso") redirect(rutaEntrenamiento);

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
    revalidateTag(TAG_RANKING, { expire: 0 });
  } else {
    await supabase.from("sesiones_entrenamiento").delete().eq("id", sesionId).eq("alumno_id", alumnoId);
  }

  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/entrenar/historial");
  revalidatePath("/alumno/inicio");
  revalidatePath("/portal-v2/entrenamiento");
  revalidatePath("/portal-v2/entrenamiento/historial");
  redirect(rutaEntrenamiento);
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

  // La relación con la sesión confirma que el ejercicio pertenece al alumno
  // autenticado. Sin ella un cliente modificado podía crear movimientos con
  // ids arbitrarios (siempre contra sí mismo, pero contaminando el ranking).
  const supabase = createAdminClient();
  const { data: ejercicioPropio } = await supabase
    .from("sesion_ejercicios")
    .select("id, sesiones_entrenamiento!inner(alumno_id, estado), rutina_dia_ejercicios(series_programadas)")
    .eq("id", sesionEjercicioId)
    .eq("sesiones_entrenamiento.alumno_id", alumnoId)
    .eq("sesiones_entrenamiento.estado", "en_progreso")
    .maybeSingle();
  if (!ejercicioPropio) return;
  const asignacion = ejercicioPropio.rutina_dia_ejercicios as unknown as { series_programadas: number } | null;
  if (!asignacion || numero > asignacion.series_programadas) return;

  await registrarPenalizacionDescanso({
    alumnoId,
    sesionEjercicioId,
    numero,
    tramosExcedidos,
    fecha: hoyISO(),
  });
  revalidateTag(TAG_RANKING, { expire: 0 });
}
