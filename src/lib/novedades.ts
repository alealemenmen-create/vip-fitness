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
 * Se agregan a mano (vía script) después de cada cambio real que se sube a
 * producción; esto solo lee y muestra. */
export async function obtenerNovedades(limite = 40): Promise<Novedad[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registro_cambios")
    .select("id, titulo, resumen, categoria, creado_en")
    .order("creado_en", { ascending: false })
    .limit(limite);

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
