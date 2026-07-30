import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_EJERCICIO, aEjercicio, type Ejercicio } from "./tipos";

export const TAG_BIBLIOTECA_EJERCICIOS = "biblioteca-ejercicios";

/**
 * La biblioteca completa de ejercicios activos.
 *
 * Va cacheada porque es lo contrario de un dato personal: son las mismas ~74
 * filas para todos los alumnos y cambian cuando el entrenador agrega un
 * ejercicio, o sea casi nunca. Sin caché, cada importación de rutina pagaba un
 * viaje de ~95ms a Supabase para leer siempre lo mismo.
 *
 * Al crear o editar un ejercicio hay que llamar a `updateTag` con
 * TAG_BIBLIOTECA_EJERCICIOS desde la Server Action, para que el cambio se vea
 * al instante en vez de esperar el vencimiento.
 */
export const obtenerBiblioteca = unstable_cache(
  async (): Promise<Ejercicio[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("ejercicios")
      .select(COLUMNAS_EJERCICIO)
      .eq("activo", true)
      .order("nombre");

    return ((data ?? []) as unknown as Parameters<typeof aEjercicio>[0][]).map(aEjercicio);
  },
  ["biblioteca-ejercicios"],
  { revalidate: 3600, tags: [TAG_BIBLIOTECA_EJERCICIOS] }
);
