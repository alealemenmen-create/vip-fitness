import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ResumenMemoriaImpulso = {
  id: string;
  alumno: string;
  ejercicio: string;
  tecnica: "drop_set" | "rest_pause" | "fallo_controlado";
  intentos: number;
  logradas: number;
  verificadas: number;
  molestias: number;
  racha: number;
  confianza: "en_prueba" | "confiable" | "retroceder";
  ultimoResultado: string | null;
};

/** Resumen accionable, no historial infinito: prioriza retrocesos, luego
 * perfiles en prueba y por ultimo los dominados recientemente. */
export async function obtenerResumenMemoriaImpulso(
  supabase: SupabaseClient<Database>,
  limite = 8,
): Promise<ResumenMemoriaImpulso[]> {
  const { data, error } = await supabase
    .from("impulso_vip_memoria_tecnicas")
    .select("id, tecnica, intentos, logradas, verificadas, molestias, racha, confianza, ultimo_resultado, updated_at, perfiles!impulso_vip_memoria_tecnicas_alumno_id_fkey(nombre), ejercicios!impulso_vip_memoria_tecnicas_ejercicio_id_fkey(nombre)")
    .order("updated_at", { ascending: false })
    .limit(limite * 3);
  if (error) return [];

  type Fila = {
    id: string;
    tecnica: "drop_set" | "rest_pause" | "fallo_controlado";
    intentos: number;
    logradas: number;
    verificadas: number;
    molestias: number;
    racha: number;
    confianza: "en_prueba" | "confiable" | "retroceder";
    ultimo_resultado: string | null;
    perfiles: { nombre: string } | { nombre: string }[] | null;
    ejercicios: { nombre: string } | { nombre: string }[] | null;
  };
  const orden = { retroceder: 0, en_prueba: 1, confiable: 2 } as const;
  return ((data ?? []) as unknown as Fila[])
    .map((fila) => ({
      id: fila.id,
      alumno: (Array.isArray(fila.perfiles) ? fila.perfiles[0]?.nombre : fila.perfiles?.nombre) ?? "Alumno",
      ejercicio: (Array.isArray(fila.ejercicios) ? fila.ejercicios[0]?.nombre : fila.ejercicios?.nombre) ?? "Ejercicio",
      tecnica: fila.tecnica,
      intentos: fila.intentos,
      logradas: fila.logradas,
      verificadas: fila.verificadas,
      molestias: fila.molestias,
      racha: fila.racha,
      confianza: fila.confianza,
      ultimoResultado: fila.ultimo_resultado,
    }))
    .sort((a, b) => orden[a.confianza] - orden[b.confianza])
    .slice(0, limite);
}
