"use server";

import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
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
  creadaEn: string;
  dias: number;
  ejercicios: number;
};

export async function listarRutinasDeAlumno(alumnoId: string): Promise<RutinaDelAlumno[]> {
  await requireRol(["entrenador", "admin"]);
  if (!alumnoId) return [];
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data } = await db
    .from("rutinas")
    .select("id, nombre, activa, created_at, rutina_dias(id, tipo, rutina_dia_ejercicios(id))")
    .eq("alumno_id", alumnoId)
    .order("created_at", { ascending: false })
    .limit(40);

  type FilaDia = { id: string; tipo: string; rutina_dia_ejercicios: { id: string }[] | null };
  return ((data ?? []) as { id: string; nombre: string; activa: boolean; created_at: string; rutina_dias: FilaDia[] | null }[]).map(
    (r) => {
      const dias = r.rutina_dias ?? [];
      return {
        id: r.id,
        nombre: r.nombre,
        activa: r.activa,
        creadaEn: r.created_at,
        dias: dias.filter((d) => d.tipo === "entrenamiento").length,
        ejercicios: dias.reduce((total, d) => total + (d.rutina_dia_ejercicios?.length ?? 0), 0),
      };
    }
  );
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
