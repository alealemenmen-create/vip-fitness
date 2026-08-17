import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLUMNAS_EJERCICIO,
  COLUMNAS_EJERCICIO_COMPLETO,
  COLUMNAS_EJERCICIO_CON_ENCUADRE,
  COLUMNAS_EJERCICIO_IMPULSO,
  COLUMNAS_EJERCICIO_IMPULSO_CON_HASH,
  COLUMNAS_EJERCICIO_INCOMPLETO,
  COLUMNAS_EJERCICIO_MULTIMEDIA,
  COLUMNAS_EJERCICIO_SIN_FOTOS,
  aEjercicio,
  aEjercicioIncompleto,
  type Ejercicio,
  type EjercicioIncompleto,
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

  // Filtra calidad_ficha='completa' — un ejercicio creado desde el alta
  // rápida sin clasificar (instructivo §7.3) no debe llegar al generador de
  // rutinas ni a los emparejados de Mesa/Carga masiva hasta que alguien lo
  // complete desde la cola "Completar ficha" (ver obtenerEjerciciosIncompletos
  // más abajo). Si la migración 0099 todavía no corrió, esta query falla por
  // columna inexistente y cae al nivel de abajo, que no filtra nada — mismo
  // comportamiento de siempre (todo clasificado, porque no podía no estarlo).
  const conCalidad = await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_COMPLETO)
    .eq("activo", true)
    .eq("calidad_ficha", "completa")
    .order("nombre");

  const conHash = conCalidad.error ? await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_IMPULSO_CON_HASH)
    .eq("activo", true)
    .order("nombre") : conCalidad;

  // Si la migración 0042 (foto_miniatura_url/foto_completa_url) todavía no
  // corrió en este entorno, pedir esas columnas hace fallar el select
  // ENTERO — antes se leía `data ?? []` sin mirar el error, así que la
  // biblioteca se quedaba vacía en silencio para toda la app. Mismo
  // respaldo encadenado que ya usa obtenerSesionCompleta para 0026/0031.
  const conImpulso = conHash.error ? await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_IMPULSO)
    .eq("activo", true)
    .order("nombre") : conHash;

  const conMultimedia = conImpulso.error ? await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_MULTIMEDIA)
    .eq("activo", true)
    .order("nombre") : conImpulso;

  const conEncuadre = conMultimedia.error ? await supabase
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_CON_ENCUADRE)
    .eq("activo", true)
    .order("nombre") : conMultimedia;

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

/**
 * Cola "Completar ficha" (instructivo §7.3): ejercicios activos creados
 * desde el alta rápida sin grupo/categoría/equipo. Sin caché — la misma
 * lógica que `obtenerBibliotecaSinCache`, es la pantalla donde el
 * entrenador acaba de crearlos y tiene que verlos. Devuelve `[]` sin
 * reventar si la migración 0099 todavía no corrió (mismo criterio que
 * `obtenerHistorialFusiones`): antes de esa migración no existía el
 * concepto de ficha incompleta, así que no hay nada que mostrar.
 */
export async function obtenerEjerciciosIncompletos(): Promise<EjercicioIncompleto[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ejercicios")
    .select(COLUMNAS_EJERCICIO_INCOMPLETO)
    .eq("activo", true)
    .eq("calidad_ficha", "requiere_clasificacion")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code !== "42703" && error.code !== "PGRST204") {
      console.error("[ejercicios] no se pudo leer las fichas incompletas:", error.message);
    }
    return [];
  }
  return (data ?? []).map((fila) => aEjercicioIncompleto(fila as unknown as Parameters<typeof aEjercicioIncompleto>[0]));
}

export type FusionEjercicio = {
  id: string;
  originalNombre: string;
  duplicadoNombre: string;
  usosTrasladados: number;
  fusionadoEn: string;
  deshecho: boolean;
};

const DIAS_VENTANA_RESTAURACION = 30;

/**
 * Historial reciente de fusiones de duplicados (ver `ejercicio_fusiones`,
 * migración 0093) — sección 8.7 del instructivo de reorganización del panel:
 * "permite restaurar desde la ficha del ejercicio" durante un período
 * definido. Devuelve `[]` sin reventar si la migración todavía no corrió
 * contra esta base — mismo criterio que `/admin/gastos` y `/admin/reportes`.
 */
export async function obtenerHistorialFusiones(): Promise<FusionEjercicio[]> {
  const admin = createAdminClient();
  const desde = new Date(Date.now() - DIAS_VENTANA_RESTAURACION * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("ejercicio_fusiones")
    .select("id,original_nombre,duplicado_nombre,rutina_dia_ejercicios_ids,fusionado_en,deshecho_en")
    .gte("fusionado_en", desde)
    .order("fusionado_en", { ascending: false })
    .limit(20);
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") {
      console.error("[ejercicios] no se pudo leer el historial de fusiones:", error.message);
    }
    return [];
  }
  return (data ?? []).map((fila) => ({
    id: fila.id,
    originalNombre: fila.original_nombre,
    duplicadoNombre: fila.duplicado_nombre,
    usosTrasladados: (fila.rutina_dia_ejercicios_ids ?? []).length,
    fusionadoEn: fila.fusionado_en,
    deshecho: fila.deshecho_en !== null,
  }));
}

/**
 * Qué ejercicios tienen una foto anterior guardada y restaurable (ver
 * ejercicio_foto_version_anterior, migración 0094) — clave: ejercicio_id,
 * valor: fecha del reemplazo que la dejó ahí. Devuelve `{}` sin reventar si
 * la migración todavía no corrió, mismo criterio que `obtenerHistorialFusiones`.
 */
export async function obtenerVersionesAnterioresFotos(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ejercicio_foto_version_anterior")
    .select("ejercicio_id, reemplazada_en");
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") {
      console.error("[ejercicios] no se pudo leer las versiones anteriores de fotos:", error.message);
    }
    return {};
  }
  return Object.fromEntries((data ?? []).map((fila) => [fila.ejercicio_id, fila.reemplazada_en]));
}
