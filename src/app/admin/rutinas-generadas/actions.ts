"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import { normalizarTecnicaSeries } from "@/lib/entrenamiento/tecnica-series";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rutinas ya hechas de una persona, para volver a abrirlas y editarlas.
 *
 * Pedido textual: "elegir persona, ver sus rutinas, abrir una, editarla en
 * armar-a-mano y republicar".
 *
 * La fuente es `rutinas` (lo publicado) y no `borradores_generador_rutinas`,
 * aunque el handoff apuntaba a esa tabla: los borradores solo existen para lo
 * que salió del generador automático. Lo armado a mano y lo importado de PDF
 * nunca pasan por ahí, y son justamente la mayor parte de lo que él arma hoy.
 * Lo publicado, en cambio, cubre las tres puertas por igual.
 *
 * Reabrir NO toca la rutina vieja: se carga en la mesa de trabajo como punto
 * de partida y al publicar se crea una rutina nueva, con el flujo normal, que
 * pasa a ser la activa. El historial del alumno queda intacto — ver "Regla de
 * continuidad" en el handoff.
 */

export type RutinaDelAlumno = {
  id: string;
  nombre: string;
  activa: boolean;
  archivada: boolean;
  creadaEn: string;
  dias: number;
  ejercicios: number;
};

export async function listarRutinasDeAlumno(
  alumnoId: string,
  incluirArchivadas = false
): Promise<RutinaDelAlumno[]> {
  await requireRol(["entrenador", "admin"]);
  if (!alumnoId) return [];
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  let consulta = db
    .from("rutinas")
    .select("id, nombre, activa, archivada, created_at, rutina_dias(id, tipo, rutina_dia_ejercicios(id))")
    .eq("alumno_id", alumnoId);
  if (!incluirArchivadas) consulta = consulta.eq("archivada", false);

  const { data } = await consulta.order("created_at", { ascending: false }).limit(40);

  type FilaDia = { id: string; tipo: string; rutina_dia_ejercicios: { id: string }[] | null };
  return (
    (data ?? []) as {
      id: string;
      nombre: string;
      activa: boolean;
      archivada: boolean;
      created_at: string;
      rutina_dias: FilaDia[] | null;
    }[]
  ).map((r) => {
    const dias = r.rutina_dias ?? [];
    return {
      id: r.id,
      nombre: r.nombre,
      activa: r.activa,
      archivada: r.archivada,
      creadaEn: r.created_at,
      dias: dias.filter((d) => d.tipo === "entrenamiento").length,
      ejercicios: dias.reduce((total, d) => total + (d.rutina_dia_ejercicios?.length ?? 0), 0),
    };
  });
}

export type ArchivarRutinaState = { ok: boolean; error: string | null };

/** Archiva u oculta una rutina del listado normal, sin borrar nada — las
 * sesiones ya entrenadas y los puntos VIP (atados a la sesión, no a la
 * rutina) quedan intactos. No se puede archivar la rutina activa: primero
 * hay que publicar otra o desactivarla. */
export async function archivarRutina(rutinaId: string, archivar: boolean): Promise<ArchivarRutinaState> {
  await requireRol(["entrenador", "admin"]);
  if (!rutinaId) return { ok: false, error: "Falta la rutina." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  if (archivar) {
    const { data: rutina } = await db.from("rutinas").select("activa").eq("id", rutinaId).maybeSingle();
    if (rutina?.activa) {
      return { ok: false, error: "No se puede archivar la rutina activa del alumno." };
    }
  }

  const { error } = await db.from("rutinas").update({ archivada: archivar }).eq("id", rutinaId);
  if (error) return { ok: false, error: "No se pudo actualizar la rutina." };

  revalidatePath("/admin/rutinas-generadas");
  return { ok: true, error: null };
}

export type RutinaAbierta = { ok: true; rutina: RutinaExtraida } | { ok: false; error: string };

type FilaEjercicio = {
  orden: number;
  nombre: string;
  series_programadas: number;
  reps_programadas: string | null;
  descanso_segundos: number | null;
  tecnica_tipo: string | null;
  tecnica_series: number[] | null;
  tecnica_instruccion: string | null;
  observacion: string | null;
  grupo_muscular: RutinaExtraida["dias"][number]["ejercicios"][number]["grupoMuscular"];
  ejercicio_id: string | null;
};

type FilaDia = {
  orden: number;
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  descripcion: string | null;
  rutina_dia_ejercicios: FilaEjercicio[];
};

/**
 * La misma reconstrucción que `obtenerRutinaComoTexto`, pero devolviendo la
 * estructura en vez del texto — y con `ejercicio_id`, que ahí no hacía falta y
 * acá es imprescindible: al republicar, un ejercicio sin id real perdería su
 * ilustración y su historial de progresión (ver "toda referencia visual
 * depende de un ID real" en el handoff).
 */
export async function abrirRutinaPublicada(rutinaId: string): Promise<RutinaAbierta> {
  await requireRol(["entrenador", "admin"]);
  if (!rutinaId) return { ok: false, error: "Falta la rutina." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: rutina, error } = await db
    .from("rutinas")
    .select(
      "nombre, rutina_dias(orden, nombre, tipo, descripcion, rutina_dia_ejercicios(orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_series, tecnica_instruccion, observacion, grupo_muscular, ejercicio_id))"
    )
    .eq("id", rutinaId)
    .maybeSingle();

  if (error || !rutina) return { ok: false, error: "No se pudo leer esa rutina." };

  const dias = ((rutina.rutina_dias ?? []) as FilaDia[])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((d) => ({
      numero: d.orden,
      nombre: d.nombre,
      tipo: d.tipo,
      descripcion: d.descripcion,
      ejercicios: (d.rutina_dia_ejercicios ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((e) => ({
          orden: e.orden,
          nombre: e.nombre,
          series: e.series_programadas,
          reps: e.reps_programadas ?? "10-12",
          descansoSegundos: e.descanso_segundos,
          tecnicaTipo: e.tecnica_tipo,
          // Sin esto, reabrir una rutina hecha en el editor perdía en silencio
          // las series marcadas y la técnica volvía a aplicarse a todas.
          tecnicaSeries: e.tecnica_series,
          tecnicaInstruccion: e.tecnica_instruccion,
          observacion: e.observacion,
          grupoMuscular: e.grupo_muscular,
          ejercicioId: e.ejercicio_id ?? undefined,
        })),
    }));

  if (dias.length === 0) return { ok: false, error: "Esa rutina no tiene días cargados." };

  // "(copia)" en el nombre a propósito: si se republica tal cual, el alumno
  // termina con dos rutinas del mismo nombre en su historial y no hay forma de
  // distinguirlas. El entrenador lo edita antes de publicar.
  return {
    ok: true,
    rutina: { nombreRutina: `${rutina.nombre as string} (copia)`, dias },
  };
}

/* ------------------------------------------------------------------ *
 * Ajuste rápido: cambiar solo los números de una rutina, EN EL LUGAR.
 * ------------------------------------------------------------------ */

/**
 * Por qué esto edita la fila que ya existe en vez de republicar como copia
 * (que es lo que hace el resto de este archivo):
 *
 * El historial de Impulso VIP cuelga de `dia_ejercicio_id`, la fila concreta
 * de `rutina_dia_ejercicios` — ver `obtenerHistorialParaMotor`. Republicar
 * crea filas nuevas, así que **cada ejercicio pierde su progresión** y el
 * motor vuelve a arrancar de cero: el alumno se queda sin metas hasta volver
 * a juntar historial. Para un cambio de "4 series a 3" ese costo es
 * desproporcionado e invisible.
 *
 * Editando en el lugar se conservan las mismas filas, y con ellas la
 * progresión, las sesiones ya entrenadas y la configuración de progresión.
 * Los puntos VIP no dependen de la rutina en ningún caso (cuelgan del alumno,
 * ver HANDOFF 1.23), así que tampoco se tocan por ninguno de los dos caminos.
 *
 * A cambio, esto NO deja rastro en el historial de rutinas: es a propósito,
 * corregir un número no es una rutina nueva. Para cambiar ejercicios,
 * técnicas o días sigue estando "Abrir", que republica como copia.
 */

export type EjercicioNumeros = {
  id: string;
  nombre: string;
  series: number;
  reps: string;
  descansoSegundos: number | null;
  tecnicaTipo: string | null;
};

export type DiaNumeros = {
  id: string;
  nombre: string;
  orden: number;
  ejercicios: EjercicioNumeros[];
};

export type RutinaNumeros = {
  rutinaId: string;
  nombre: string;
  /** Con una sesión abierta, cambiar las series programadas le movería el
   * piso al alumno mientras entrena. Se bloquea y se le explica. */
  sesionEnProgreso: boolean;
  dias: DiaNumeros[];
};

export type CargarNumerosState = { ok: true; rutina: RutinaNumeros } | { ok: false; error: string };

type FilaEjercicioNumeros = {
  id: string;
  orden: number;
  nombre: string;
  series_programadas: number;
  reps_programadas: string | null;
  descanso_segundos: number | null;
  tecnica_tipo: string | null;
  tecnica_series: number[] | null;
};

export async function cargarNumerosRutina(rutinaId: string): Promise<CargarNumerosState> {
  await requireRol(["entrenador", "admin"]);
  if (!rutinaId) return { ok: false, error: "Falta la rutina." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: rutina, error } = await db
    .from("rutinas")
    .select(
      "id, nombre, alumno_id, rutina_dias(id, orden, nombre, tipo, rutina_dia_ejercicios(id, orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_series))"
    )
    .eq("id", rutinaId)
    .maybeSingle();

  if (error || !rutina) return { ok: false, error: "No se pudo leer esa rutina." };

  const { data: sesionAbierta } = await db
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("rutina_id", rutinaId)
    .eq("estado", "en_progreso")
    .limit(1)
    .maybeSingle();

  type FilaDiaNumeros = {
    id: string;
    orden: number;
    nombre: string;
    tipo: string;
    rutina_dia_ejercicios: FilaEjercicioNumeros[] | null;
  };

  const dias = ((rutina.rutina_dias ?? []) as FilaDiaNumeros[])
    .filter((d) => d.tipo === "entrenamiento")
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((d) => ({
      id: d.id,
      nombre: d.nombre,
      orden: d.orden,
      ejercicios: (d.rutina_dia_ejercicios ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((e) => ({
          id: e.id,
          nombre: e.nombre,
          series: e.series_programadas,
          reps: e.reps_programadas ?? "",
          descansoSegundos: e.descanso_segundos,
          tecnicaTipo: e.tecnica_tipo,
        })),
    }))
    .filter((d) => d.ejercicios.length > 0);

  if (dias.length === 0) return { ok: false, error: "Esa rutina no tiene ejercicios que ajustar." };

  return {
    ok: true,
    rutina: {
      rutinaId: rutina.id as string,
      nombre: rutina.nombre as string,
      sesionEnProgreso: !!sesionAbierta,
      dias,
    },
  };
}

export type CambioNumeros = {
  id: string;
  series: number;
  reps: string;
  descansoSegundos: number | null;
};

export type AjustarNumerosState = { ok: boolean; error: string | null; actualizados?: number };

const SERIES_MIN = 1;
const SERIES_MAX = 20;
const DESCANSO_MAX = 600;

export async function ajustarNumerosRutina(
  rutinaId: string,
  cambios: CambioNumeros[]
): Promise<AjustarNumerosState> {
  await requireRol(["entrenador", "admin"]);
  if (!rutinaId) return { ok: false, error: "Falta la rutina." };
  if (cambios.length === 0) return { ok: true, error: null, actualizados: 0 };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Las filas reales de ESTA rutina. Nada de confiar en los ids que llegan del
  // navegador: se usan solo para buscar acá dentro, así que un id de otra
  // rutina (o inventado) no puede tocar nada.
  const { data: rutina, error: errorLectura } = await db
    .from("rutinas")
    .select("id, alumno_id, rutina_dias(id, rutina_dia_ejercicios(id, series_programadas, tecnica_series))")
    .eq("id", rutinaId)
    .maybeSingle();
  if (errorLectura || !rutina) return { ok: false, error: "No se pudo leer esa rutina." };

  const { data: sesionAbierta } = await db
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("rutina_id", rutinaId)
    .eq("estado", "en_progreso")
    .limit(1)
    .maybeSingle();
  if (sesionAbierta) {
    return {
      ok: false,
      error: "El alumno tiene un entrenamiento abierto ahora mismo. Espera a que lo cierre para no cambiarle los números mientras entrena.",
    };
  }

  type FilaDia = {
    rutina_dia_ejercicios: { id: string; series_programadas: number; tecnica_series: number[] | null }[] | null;
  };
  const existentes = new Map(
    ((rutina.rutina_dias ?? []) as FilaDia[])
      .flatMap((d) => d.rutina_dia_ejercicios ?? [])
      .map((e) => [e.id, e] as const)
  );

  const validos: (CambioNumeros & { tecnicaSeries: number[] | null; seriesPrevias: number })[] = [];
  for (const cambio of cambios) {
    const actual = existentes.get(cambio.id);
    if (!actual) continue;
    if (!Number.isInteger(cambio.series) || cambio.series < SERIES_MIN || cambio.series > SERIES_MAX) {
      return { ok: false, error: `Las series tienen que ser un número entre ${SERIES_MIN} y ${SERIES_MAX}.` };
    }
    const reps = cambio.reps.trim();
    if (!reps) return { ok: false, error: "Hay un ejercicio sin repeticiones." };
    if (reps.length > 40) return { ok: false, error: "Las repeticiones son demasiado largas." };
    if (
      cambio.descansoSegundos !== null
      && (!Number.isInteger(cambio.descansoSegundos) || cambio.descansoSegundos < 0 || cambio.descansoSegundos > DESCANSO_MAX)
    ) {
      return { ok: false, error: `El descanso tiene que ir entre 0 y ${DESCANSO_MAX} segundos.` };
    }
    validos.push({
      ...cambio,
      reps,
      tecnicaSeries: actual.tecnica_series,
      seriesPrevias: actual.series_programadas,
    });
  }
  if (validos.length === 0) return { ok: true, error: null, actualizados: 0 };

  // Bajar las series puede dejar una técnica apuntando a una serie que ya no
  // existe (drop set en la 4 de un ejercicio que pasa a tener 3). El CHECK de
  // la migración 0073 compara ambas columnas de LA MISMA fila, así que la
  // técnica hay que renormalizarla en el mismo UPDATE — - hacerlo después
  // fallaría antes de llegar. Son pocas filas y van de a una; el resto se
  // agrupa abajo.
  const conTecnicaAReparar = validos.filter((v) => {
    if (!v.tecnicaSeries || v.series >= v.seriesPrevias) return false;
    return v.tecnicaSeries.some((n) => n > v.series);
  });
  const idsAReparar = new Set(conTecnicaAReparar.map((v) => v.id));

  for (const v of conTecnicaAReparar) {
    const { error } = await db
      .from("rutina_dia_ejercicios")
      .update({
        series_programadas: v.series,
        reps_programadas: v.reps,
        descanso_segundos: v.descansoSegundos,
        tecnica_series: normalizarTecnicaSeries(v.tecnicaSeries, v.series),
      })
      .eq("id", v.id);
    if (error) return { ok: false, error: "No se pudieron guardar los cambios. Intenta nuevamente." };
  }

  // Agrupados por valores idénticos: el caso real que motivó esto ("todos los
  // ejercicios a 3 series") se resuelve en una sola consulta en vez de una por
  // ejercicio.
  const porValores = new Map<string, { series: number; reps: string; descanso: number | null; ids: string[] }>();
  for (const v of validos) {
    if (idsAReparar.has(v.id)) continue;
    const clave = `${v.series}|${v.reps}|${v.descansoSegundos ?? "null"}`;
    const grupo = porValores.get(clave);
    if (grupo) grupo.ids.push(v.id);
    else porValores.set(clave, { series: v.series, reps: v.reps, descanso: v.descansoSegundos, ids: [v.id] });
  }

  for (const grupo of porValores.values()) {
    const { error } = await db
      .from("rutina_dia_ejercicios")
      .update({
        series_programadas: grupo.series,
        reps_programadas: grupo.reps,
        descanso_segundos: grupo.descanso,
      })
      .in("id", grupo.ids);
    if (error) return { ok: false, error: "No se pudieron guardar los cambios. Intenta nuevamente." };
  }

  revalidatePath("/admin/rutinas-generadas");
  revalidatePath("/admin/alumnos");
  revalidatePath("/alumno/entrenar");
  return { ok: true, error: null, actualizados: validos.length };
}
