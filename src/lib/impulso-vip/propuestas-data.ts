import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoIntervencionImpulso } from "@/lib/supabase/types";

export type PropuestaImpulso = {
  id: string;
  alumno: string;
  ejercicio: string;
  serie: number;
  tipo: TipoIntervencionImpulso;
  instruccion: string;
  requiereRevision: boolean;
  aprobadaPorAle: boolean;
};

const INTENSAS = new Set<TipoIntervencionImpulso>(["drop_set", "rest_pause", "fallo_controlado"]);

export function propuestaRequiereRevision(params: {
  tipo: TipoIntervencionImpulso;
  prescripcion: Record<string, unknown>;
}): boolean {
  return INTENSAS.has(params.tipo) || params.prescripcion.requiereSupervision === true;
}

/** Intervenciones automáticas todavía no mostradas: funcionan como bandeja
 * de propuestas. Si Ale no entra, las seguras siguen su curso al llegar a la
 * serie; la bandeja existe para supervisar excepciones, no para crear trabajo. */
export async function obtenerPropuestasImpulso(
  supabase: SupabaseClient<Database>,
  limite = 30,
): Promise<PropuestaImpulso[]> {
  const { data, error } = await supabase
    .from("impulso_vip_intervenciones")
    .select("id, alumno_id, serie_objetivo, tipo, instruccion, prescripcion, decision_data, perfiles!impulso_vip_intervenciones_alumno_id_fkey(nombre), sesion_ejercicios!inner(rutina_dia_ejercicios(nombre), sesiones_entrenamiento!inner(estado))")
    .eq("origen", "metodo_ale")
    .eq("estado", "preparada")
    .eq("sesion_ejercicios.sesiones_entrenamiento.estado", "en_progreso")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) return [];

  type Fila = {
    id: string;
    serie_objetivo: number;
    tipo: TipoIntervencionImpulso;
    instruccion: string;
    prescripcion: Record<string, unknown>;
    decision_data: Record<string, unknown>;
    perfiles: { nombre: string } | { nombre: string }[] | null;
    sesion_ejercicios: {
      rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
    } | {
      rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
    }[] | null;
  };
  return ((data ?? []) as unknown as Fila[]).map((fila) => {
    const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles;
    const sesionEjercicio = Array.isArray(fila.sesion_ejercicios) ? fila.sesion_ejercicios[0] : fila.sesion_ejercicios;
    const asignacion = Array.isArray(sesionEjercicio?.rutina_dia_ejercicios)
      ? sesionEjercicio.rutina_dia_ejercicios[0]
      : sesionEjercicio?.rutina_dia_ejercicios;
    return {
      id: fila.id,
      alumno: perfil?.nombre ?? "Alumno",
      ejercicio: asignacion?.nombre ?? "Ejercicio",
      serie: fila.serie_objetivo,
      tipo: fila.tipo,
      instruccion: fila.instruccion,
      requiereRevision: propuestaRequiereRevision({ tipo: fila.tipo, prescripcion: fila.prescripcion ?? {} }),
      aprobadaPorAle: typeof fila.decision_data?.aprobadaPorAleEn === "string",
    };
  }).sort((a, b) => Number(b.requiereRevision) - Number(a.requiereRevision));
}
