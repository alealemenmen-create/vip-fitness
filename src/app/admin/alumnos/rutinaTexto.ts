"use server";

import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serializarRutinaATexto } from "@/lib/generador-rutinas/serializar";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Devuelve una rutina ya publicada como texto plano, en el mismo formato que
 * genera el borrador.
 *
 * Para qué: "si yo quiero tomar una rutina que ya hiciste, voy al alumno,
 * extraigo la rutina y la pego en el nuevo alumno". El texto que sale de acá
 * se pega tal cual en Documentos → Pegar texto, que ya sabe leerlo y lo deja
 * en el editor de borrador para ajustarlo antes de publicar.
 *
 * No copia la rutina directo de un alumno a otro a propósito: pasa por el
 * editor para que el entrenador la revise contra la persona nueva, que es lo
 * que evita que dos alumnos distintos terminen con la misma rutina sin que
 * nadie lo haya mirado. */
export type RutinaTextoResultado =
  | { ok: true; nombre: string; texto: string }
  | { ok: false; error: string };

type FilaEjercicio = {
  orden: number;
  nombre: string;
  series_programadas: number;
  reps_programadas: string | null;
  descanso_segundos: number | null;
  tecnica_tipo: string | null;
  tecnica_instruccion: string | null;
  observacion: string | null;
  grupo_muscular: RutinaExtraida["dias"][number]["ejercicios"][number]["grupoMuscular"];
};

type FilaDia = {
  orden: number;
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  descripcion: string | null;
  rutina_dia_ejercicios: FilaEjercicio[];
};

export async function obtenerRutinaComoTexto(rutinaId: string): Promise<RutinaTextoResultado> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: rutina, error } = await db
    .from("rutinas")
    .select(
      "nombre, rutina_dias(orden, nombre, tipo, descripcion, rutina_dia_ejercicios(orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion, grupo_muscular))"
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
          tecnicaInstruccion: e.tecnica_instruccion,
          observacion: e.observacion,
          grupoMuscular: e.grupo_muscular,
        })),
    }));

  if (dias.length === 0) return { ok: false, error: "Esa rutina no tiene días cargados." };

  const datos: RutinaExtraida = { nombreRutina: rutina.nombre as string, dias };
  return { ok: true, nombre: rutina.nombre as string, texto: serializarRutinaATexto(datos) };
}
