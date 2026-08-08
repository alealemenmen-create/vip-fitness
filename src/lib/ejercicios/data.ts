import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLUMNAS_EJERCICIO,
  COLUMNAS_EJERCICIO_CON_ENCUADRE,
  COLUMNAS_EJERCICIO_SIN_FOTOS,
  aEjercicio,
  type Ejercicio,
} from "./tipos";

export const TAG_BIBLIOTECA_EJERCICIOS = "biblioteca-ejercicios";

/**
 * La biblioteca completa de ejercicios activos.
 *
 * Va cacheada porque es lo contrario de un dato personal: son las mismas ~74
 * filas para todos los alumnos y cambian cuando el entrenador agrega un
 * ejercicio, o sea casi nunca. Sin caché, cada importación de rutina pagaba un
 * viaje de ~95ms a Supabase para leer siempre lo mismo.
 *
 * Al crear o editar un ejercicio hay que llamar a `revalidateTag` con
 * TAG_BIBLIOTECA_EJERCICIOS desde la Server Action, para que el cambio se vea
 * al instante en vez de esperar el vencimiento.
 *
 * ⚠️ Tiene que ser `revalidateTag`, NO `updateTag`. `updateTag` solo invalida
 * datos de `fetch` con `next.tags` o funciones con la directiva `'use cache'`
 * — no toca las entradas de `unstable_cache` como esta. Estuvo mal durante un
 * tiempo y el síntoma era desconcertante: la foto se subía bien a Storage y la
 * URL quedaba guardada en la base, pero la galería seguía mostrando "sin foto"
 * hasta una hora (el TTL de acá), porque leía esta caché vieja.
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
async function leerBiblioteca(): Promise<Ejercicio[]> {
  const supabase = createAdminClient();

  // Si la migración 0042 (foto_miniatura_url/foto_completa_url) todavía no
  // corrió en este entorno, pedir esas columnas hace fallar el select
  // ENTERO — antes se leía `data ?? []` sin mirar el error, así que la
  // biblioteca se quedaba vacía en silencio para toda la app. Mismo
  // respaldo encadenado que ya usa obtenerSesionCompleta para 0026/0031.
  const conEncuadre = await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_CON_ENCUADRE)
    .eq("activo", true)
    .order("nombre");

  const conFotos = conEncuadre.error ? await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO)
    .eq("activo", true)
    .order("nombre") : conEncuadre;

  const resultado = conFotos.error
    ? await supabase
        .from("ejercicios")
        .select(COLUMNAS_EJERCICIO_SIN_FOTOS)
        .eq("activo", true)
        .order("nombre")
    : conFotos;

  return ((resultado.data ?? []) as unknown as Parameters<typeof aEjercicio>[0][]).map(aEjercicio);
}

export const obtenerBiblioteca = unstable_cache(leerBiblioteca, ["biblioteca-ejercicios"], {
  revalidate: 3600,
  tags: [TAG_BIBLIOTECA_EJERCICIOS],
});

/**
 * La misma biblioteca, pero SIN caché — para la galería de `/admin/ejercicios`.
 *
 * La caché de arriba existe por el volumen del lado del alumno (una consulta
 * por importación de rutina y por sesión). La galería, en cambio, la usa una
 * sola persona (el entrenador) y es justo la pantalla donde acaba de subir una
 * foto: ahí la exactitud vale mucho más que ahorrarse un viaje de ~95ms a
 * Supabase. Leyendo fresco, lo que ve el entrenador es siempre el estado real
 * de la base, sin depender de que la invalidación por etiqueta haya llegado.
 */
export function obtenerBibliotecaSinCache(): Promise<Ejercicio[]> {
  return leerBiblioteca();
}
