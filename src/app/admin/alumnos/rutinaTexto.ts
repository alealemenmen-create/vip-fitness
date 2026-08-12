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

async function cargarRutinaEstructurada(
  rutinaId: string
): Promise<{ ok: true; datos: RutinaExtraida } | { ok: false; error: string }> {
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

  return { ok: true, datos: { nombreRutina: rutina.nombre as string, dias } };
}

export async function obtenerRutinaComoTexto(rutinaId: string): Promise<RutinaTextoResultado> {
  const r = await cargarRutinaEstructurada(rutinaId);
  if (!r.ok) return r;
  return { ok: true, nombre: r.datos.nombreRutina, texto: serializarRutinaATexto(r.datos) };
}

export type RutinaBorradorResultado =
  | { ok: true; nombre: string; rutina: RutinaExtraida; diasEntrenamiento: number }
  | { ok: false; error: string };

/** Igual que `obtenerRutinaComoTexto`, pero sin aplanar a texto: devuelve la
 * misma forma (`RutinaExtraida`) que ya usa `ArmarRutinaPanel` como borrador
 * en memoria. Existe para "aplicar esta rutina a otros alumnos" — ver
 * `AplicarRutinaAOtrosAlumnos.tsx`, que la deja en el mismo respaldo local
 * del asistente (`asistente-armado-local.ts`) y manda al entrenador
 * directo al selector de alumnos, ya con la rutina cargada. Sigue pasando
 * por la mesa de trabajo antes de publicar — mismo criterio documentado en
 * `CopiarRutinaAlumno`: nunca copiar directo sin que alguien la revise. */
export async function obtenerRutinaComoBorrador(rutinaId: string): Promise<RutinaBorradorResultado> {
  const r = await cargarRutinaEstructurada(rutinaId);
  if (!r.ok) return r;
  const diasEntrenamiento = r.datos.dias.filter((d) => d.tipo === "entrenamiento").length;
  return { ok: true, nombre: r.datos.nombreRutina, rutina: r.datos, diasEntrenamiento: diasEntrenamiento || 3 };
}

export type AlumnoBasico = { id: string; nombre: string };

/** Lista liviana de alumnos (solo id + nombre), para el picker de "Agregar
 * alguien más" en la mesa de trabajo (`RutinaDraftEditor`). Pedido de
 * Alejandro: justo antes de "Asignar rutina", poder sumar más alumnos sin
 * salir de esa pantalla — sea que llegó ahí armando una rutina nueva o
 * editando una ya hecha. No lleva ficha ni plan (eso ya se decidió antes,
 * al elegir el nivel/plan de la rutina): acá solo hace falta el nombre para
 * elegir a quién más publicarle exactamente lo mismo. */
export async function obtenerListaAlumnosBasica(): Promise<AlumnoBasico[]> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data } = await db
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)")
    .order("created_at");

  return (data ?? [])
    .map((f) => {
      const rel = f.perfiles as unknown as { nombre: string } | null;
      return { id: f.user_id as string, nombre: rel?.nombre ?? "Alumno" };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
