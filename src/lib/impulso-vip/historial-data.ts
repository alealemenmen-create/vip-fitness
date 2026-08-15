import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResultadoIntervencionImpulso, TipoIntervencionImpulso } from "@/lib/supabase/types";

export type ResultadoHistorialImpulso = {
  id: string;
  alumno: string;
  ejercicio: string;
  tipo: TipoIntervencionImpulso;
  resultado: ResultadoIntervencionImpulso;
  resueltaEn: string;
};

/** Feed cronológico chico de los últimos Momentos Impulso resueltos — lo que
 * Ale pidió recibir en vez de un aviso por cada propuesta o pedido de ayuda:
 * enterarse de cómo le fue al alumno, después de que pasó. */
export async function obtenerHistorialImpulsoReciente(
  supabase: SupabaseClient<Database>,
  limite = 12,
): Promise<ResultadoHistorialImpulso[]> {
  const { data, error } = await supabase
    .from("impulso_vip_intervenciones")
    .select("id, tipo, resultado, resuelta_en, perfiles!impulso_vip_intervenciones_alumno_id_fkey(nombre), sesion_ejercicios!impulso_vip_intervenciones_sesion_ejercicio_id_fkey(rutina_dia_ejercicios(nombre))")
    .eq("estado", "resuelta")
    .order("resuelta_en", { ascending: false })
    .limit(limite);
  if (error) return [];

  type Fila = {
    id: string;
    tipo: TipoIntervencionImpulso;
    resultado: ResultadoIntervencionImpulso | null;
    resuelta_en: string | null;
    perfiles: { nombre: string } | { nombre: string }[] | null;
    sesion_ejercicios: {
      rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
    } | {
      rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
    }[] | null;
  };
  return ((data ?? []) as unknown as Fila[])
    .filter((fila) => fila.resultado && fila.resuelta_en)
    .map((fila) => {
      const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles;
      const sesionEjercicio = Array.isArray(fila.sesion_ejercicios) ? fila.sesion_ejercicios[0] : fila.sesion_ejercicios;
      const asignacion = Array.isArray(sesionEjercicio?.rutina_dia_ejercicios)
        ? sesionEjercicio.rutina_dia_ejercicios[0]
        : sesionEjercicio?.rutina_dia_ejercicios;
      return {
        id: fila.id,
        alumno: perfil?.nombre ?? "Alumno",
        ejercicio: asignacion?.nombre ?? "Ejercicio",
        tipo: fila.tipo,
        resultado: fila.resultado as ResultadoIntervencionImpulso,
        resueltaEn: fila.resuelta_en as string,
      };
    });
}
