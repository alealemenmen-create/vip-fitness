import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsoEjercicioInventario = {
  cantidad: number;
  nombres: { nombre: string; cantidad: number }[];
};

type FilaUso = { ejercicio_id: string | null; nombre: string };

/** Lee todos los nombres usados por las rutinas, no solo los primeros 1.000
 * que entrega Supabase por defecto. Así el inventario sigue siendo confiable
 * cuando crezca la cantidad de alumnos y versiones históricas. */
export async function obtenerInventarioUsosRutina(): Promise<{
  usosPorEjercicio: Record<string, UsoEjercicioInventario>;
  nombresSinVincular: { nombre: string; cantidad: number }[];
}> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const filas: FilaUso[] = [];
  const lote = 1000;
  for (let desde = 0; ; desde += lote) {
    const { data, error } = await db.from("rutina_dia_ejercicios").select("ejercicio_id,nombre").range(desde, desde + lote - 1);
    if (error) {
      console.error("[ejercicios] no se pudieron contar usos en rutinas:", error.message);
      return { usosPorEjercicio: {}, nombresSinVincular: [] };
    }
    const bloque = (data ?? []) as FilaUso[];
    filas.push(...bloque);
    if (bloque.length < lote) break;
  }

  const porEjercicio = new Map<string, Map<string, number>>();
  const sinVincular = new Map<string, number>();
  for (const fila of filas) {
    const nombre = fila.nombre.trim() || "Sin nombre";
    if (!fila.ejercicio_id) {
      sinVincular.set(nombre, (sinVincular.get(nombre) ?? 0) + 1);
      continue;
    }
    const nombres = porEjercicio.get(fila.ejercicio_id) ?? new Map<string, number>();
    nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1);
    porEjercicio.set(fila.ejercicio_id, nombres);
  }

  return {
    usosPorEjercicio: Object.fromEntries(Array.from(porEjercicio, ([id, nombres]) => {
      const detalle = Array.from(nombres, ([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      return [id, { cantidad: detalle.reduce((total, item) => total + item.cantidad, 0), nombres: detalle }];
    })),
    nombresSinVincular: Array.from(sinVincular, ([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })),
  };
}
