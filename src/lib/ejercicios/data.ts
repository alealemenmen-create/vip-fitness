import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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
 *
 * ⚠️ Usa `createAdminClient()` y NO `createClient()`. El cliente normal lee las
 * cookies de la sesión, y Next PROHÍBE leer cookies dentro de `unstable_cache`:
 * lanza en tiempo de ejecución. Como nadie capturaba ese error, publicar una
 * rutina en producción dejaba el botón en "Publicando…" para siempre, sin
 * mensaje. En desarrollo no se notaba.
 * Además el cliente con sesión nunca tuvo sentido acá: esta caché es global
 * (una sola entrada para todos), así que la sesión de quien la llenara primero
 * habría quedado sirviendo a todos los demás. Son ejercicios, el mismo catálogo
 * para todo el mundo, sin datos personales.
 */
export const obtenerBiblioteca = unstable_cache(
  async (): Promise<Ejercicio[]> => {
    const supabase = createAdminClient();
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
