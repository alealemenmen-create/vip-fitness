import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sugerirTempos, type EjercicioParaTempo } from "@/lib/ai/tempoEjercicio";

/**
 * Completa el tempo de los ejercicios de la biblioteca que todavía no lo
 * tienen.
 *
 * Se dispara al publicar una rutina (ver src/app/admin/archivos/actions.ts):
 * ese es el único momento en que pueden aparecer ejercicios nuevos, y el
 * entrenador ya está esperando una operación lenta, así que no le sorprende.
 *
 * Nunca pisa un tempo existente — ni el que puso la IA antes ni, sobre todo,
 * el que corrigió el entrenador a mano (`tempo_origen = 'entrenador'`).
 *
 * Falla en silencio a propósito: si la IA no responde o la migración 0031
 * todavía no corrió, la rutina se publica igual y las tarjetas simplemente no
 * muestran la columna de tempo. Nunca vale la pena voltear una publicación por
 * esto.
 */
export async function rellenarTemposFaltantes(ejercicioIds: string[]): Promise<void> {
  const ids = [...new Set(ejercicioIds)];
  if (ids.length === 0) return;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ejercicios")
    .select("id, slug, nombre, grupo_muscular, categoria, equipo, nivel, descripcion_corta, tempo")
    .in("id", ids)
    .is("tempo", null);

  if (error || !data || data.length === 0) return;

  const porSlug = new Map(data.map((e) => [e.slug, e.id]));
  const paraIa: EjercicioParaTempo[] = data.map((e) => ({
    slug: e.slug,
    nombre: e.nombre,
    grupoMuscular: e.grupo_muscular,
    categoria: e.categoria,
    equipo: e.equipo,
    nivel: e.nivel,
    descripcionCorta: e.descripcion_corta,
  }));

  const resultado = await sugerirTempos(paraIa);
  if (!resultado.ok) {
    console.error("[tempo] no se pudieron sugerir tempos:", resultado.error);
    return;
  }

  // Uno por uno y no en lote: son pocas filas (solo ejercicios nuevos) y un
  // upsert masivo obligaría a reenviar todas las columnas obligatorias de la
  // biblioteca, con el riesgo de pisar datos buenos si alguna llega vacía.
  for (const sugerencia of resultado.tempos) {
    const id = porSlug.get(sugerencia.slug);
    if (!id) continue;
    const { error: errorUpdate } = await supabase
      .from("ejercicios")
      .update({ tempo: sugerencia.tempo, tempo_nota: sugerencia.nota, tempo_origen: "ia" })
      .eq("id", id)
      // Doble seguro contra una carrera con otra publicación simultánea.
      .is("tempo", null);
    if (errorUpdate) console.error(`[tempo] no se pudo guardar ${sugerencia.slug}:`, errorUpdate.message);
  }
}
