import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Novedad = {
  id: string;
  titulo: string;
  resumen: string;
  categoria: "arreglo" | "mejora" | "funcion_nueva";
  creadoEn: string;
};

/** Últimas novedades de la app para el entrenador — ver migración 0045.
 * Las entradas nuevas de producción se registran desde `novedades-deploy.ts`;
 * esta consulta mezcla ese historial automático con las explicaciones
 * manuales anteriores. */
export async function obtenerNovedades(limite?: number): Promise<Novedad[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("registro_cambios")
    .select("id, titulo, resumen, categoria, creado_en")
    .order("creado_en", { ascending: false });
  if (limite !== undefined) consulta = consulta.limit(limite);
  const { data, error } = await consulta;

  // Degrada con gracia si la migración 0045 todavía no corrió — mismo
  // criterio que el resto de Impulso VIP.
  if (error) return [];
  return (data ?? []).map((n) => ({
    id: n.id,
    titulo: n.titulo,
    resumen: n.resumen,
    categoria: n.categoria,
    creadoEn: n.creado_en,
  }));
}
