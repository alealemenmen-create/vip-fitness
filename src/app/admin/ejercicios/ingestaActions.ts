"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";

/**
 * Server Actions de las sesiones de ingesta (instructivo de galería
 * multimedia, Fase 2, §8.1/§8.2/§12). Separado de `actions.ts` — ese
 * archivo ya pasa las 1400 líneas y esto es una responsabilidad aparte
 * (persistencia de la cola), no una operación más sobre un ejercicio.
 *
 * Estas acciones NO suben ni vinculan ningún medio — eso lo sigue haciendo
 * `subirFotoEjercicio`/`crearEjercicioNuevo`/`iniciarSubidaVideoCloudflare`
 * de siempre (`actions.ts`). Acá solo se registra el AVANCE de cada archivo
 * de la cola, para que sobreviva a un refresh y para que reintentar no
 * duplique nada: antes de volver a aplicar un item, quien llama consulta
 * `obtenerItemsServidorDeIngesta` y si ese item ya figura 'aplicado', no lo
 * vuelve a tocar.
 */

export type TipoItemIngesta = "imagen" | "video";
/** Mismo vocabulario de 3 niveles que usa la cola de Carga masiva desde
 * Fase 1 (ver `Confianza` en CargaMasivaFotos.tsx) — no el de 5 niveles del
 * §9.1 del instructivo, que es del motor de coincidencias ampliado. */
export type ConfianzaItemIngesta = "alta" | "revisar" | "sin_match";
export type EstadoItemIngesta = "local" | "subiendo" | "procesando" | "listo" | "error" | "aplicado";

export type ItemIngestaServidor = {
  id: string;
  estado: EstadoItemIngesta;
  ejercicioId: string | null;
  nombreArchivo: string;
  tipo: TipoItemIngesta;
  errorDetalle: string | null;
};

export async function crearIngesta(
  origen: "carga" | "camara" | "modo_gimnasio" | "pendiente" | "alta" = "carga"
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ejercicio_ingestas")
    .insert({ entrenador_id: entrenador.userId, origen, estado: "borrador" })
    .select("id")
    .single();
  if (error || !data) {
    // "42P01"/"PGRST205": la migración 0100 todavía no corrió — la cola
    // sigue funcionando, solo que sin sobrevivir a un refresh (mismo
    // criterio best-effort que el resto de las migraciones de esta pantalla).
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("[ejercicios] no se pudo crear la ingesta:", error.message);
    }
    return { ok: false, error: "No se pudo iniciar la sesión de carga." };
  }
  return { ok: true, id: data.id };
}

/**
 * Registra (o re-registra, si ya existía) un archivo de la cola. Upsert por
 * `clave_idempotente` — agregar el mismo archivo dos veces por una recarga a
 * mitad de selección no crea dos filas.
 */
export async function registrarItemIngesta(input: {
  id: string;
  ingestaId: string;
  nombreArchivo: string;
  mime: string;
  tamanoBytes: number;
  tipo: TipoItemIngesta;
  nombreCandidato: string;
  confianza: ConfianzaItemIngesta;
  ejercicioId: string | null;
}): Promise<{ ok: boolean }> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("ejercicio_ingesta_items").upsert(
    {
      id: input.id,
      ingesta_id: input.ingestaId,
      clave_idempotente: input.id,
      nombre_archivo: input.nombreArchivo,
      mime: input.mime,
      tamano_bytes: input.tamanoBytes,
      tipo: input.tipo,
      nombre_candidato: input.nombreCandidato,
      confianza: input.confianza,
      ejercicio_id: input.ejercicioId,
      estado: "local",
    },
    { onConflict: "clave_idempotente", ignoreDuplicates: true }
  );
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    console.error("[ejercicios] no se pudo registrar el item de ingesta:", error.message);
  }
  return { ok: !error };
}

/**
 * Avanza el estado de un item ya registrado (subiendo → procesando/listo →
 * error). No toca `ejercicio_id` — eso lo fija recién `marcarItemAplicado`,
 * cuando el medio quedó de verdad vinculado.
 */
export async function actualizarEstadoItemIngesta(
  claveIdempotente: string,
  cambios: { estado: EstadoItemIngesta; errorDetalle?: string | null }
): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("ejercicio_ingesta_items")
    .select("intentos")
    .eq("clave_idempotente", claveIdempotente)
    .maybeSingle();
  await supabase
    .from("ejercicio_ingesta_items")
    .update({
      estado: cambios.estado,
      error_detalle: cambios.errorDetalle ?? null,
      actualizado_en: new Date().toISOString(),
      // Un intento nuevo arranca cada vez que la fila vuelve a "subiendo" —
      // sirve para decidir cuándo dejar de reintentar solo (instructivo
      // §12.4, "reintentos") sin necesitar una segunda columna de conteo.
      ...(cambios.estado === "subiendo" ? { intentos: (actual?.intentos ?? 0) + 1 } : {}),
    })
    .eq("clave_idempotente", claveIdempotente);
}

/**
 * El paso que de verdad importa para no duplicar nada: recién se llama
 * DESPUÉS de que `subirFotoEjercicio`/`confirmarSubidaVideoCloudflare` ya
 * devolvió éxito. Si un reintento repite esta llamada para un item que ya
 * estaba 'aplicado', el `.neq` de abajo hace que el update no toque nada —
 * no hay ventana en la que "aplicar dos veces" pueda vincular el medio dos
 * veces, porque quien reintenta primero debe consultar
 * `obtenerItemsServidorDeIngesta` y saltear los que ya figuran aplicados.
 */
export async function marcarItemAplicado(claveIdempotente: string, ejercicioId: string): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  await supabase
    .from("ejercicio_ingesta_items")
    .update({ estado: "aplicado", ejercicio_id: ejercicioId, actualizado_en: new Date().toISOString() })
    .eq("clave_idempotente", claveIdempotente)
    .neq("estado", "aplicado");
}

export async function obtenerItemsServidorDeIngesta(ingestaId: string): Promise<ItemIngestaServidor[]> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ejercicio_ingesta_items")
    .select("id, estado, ejercicio_id, nombre_archivo, tipo, error_detalle")
    .eq("ingesta_id", ingestaId);
  if (error) return [];
  return (data ?? []).map((fila) => ({
    id: fila.id,
    estado: fila.estado as EstadoItemIngesta,
    ejercicioId: fila.ejercicio_id,
    nombreArchivo: fila.nombre_archivo,
    tipo: fila.tipo as TipoItemIngesta,
    errorDetalle: fila.error_detalle,
  }));
}

/**
 * Resumen de la ingesta para el aviso "Tienes una carga sin terminar"
 * (instructivo §12.3) y para decidir cuándo marcarla completada.
 */
export type EstadoIngesta =
  | "borrador"
  | "cargando"
  | "requiere_revision"
  | "aplicando"
  | "completada"
  | "parcial"
  | "cancelada";

export async function actualizarResumenIngesta(
  ingestaId: string,
  resumen: { totalArchivos: number; archivosListos: number; archivosError: number; estado: EstadoIngesta }
): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const completada = resumen.estado === "completada" || resumen.estado === "cancelada";
  await supabase
    .from("ejercicio_ingestas")
    .update({
      total_archivos: resumen.totalArchivos,
      archivos_listos: resumen.archivosListos,
      archivos_error: resumen.archivosError,
      estado: resumen.estado,
      actualizado_en: new Date().toISOString(),
      ...(completada ? { completado_en: new Date().toISOString() } : {}),
    })
    .eq("id", ingestaId);
  revalidatePath("/admin/ejercicios");
}

export type ItemIngestaHuerfano = {
  id: string;
  nombreArchivo: string;
  tipo: TipoItemIngesta;
  estado: EstadoItemIngesta;
  actualizadoEn: string;
};

/**
 * Archivos que quedaron a medio subir hace más de un día — la sesión se
 * cerró, se cortó la conexión, o el entrenador simplemente se fue del
 * gimnasio sin terminar de aplicar la cola (instructivo §15, "archivo
 * huérfano de ingesta" y "medio temporal antiguo"). Pestaña Calidad, Fase 4.
 * No borra nada: solo avisa, para no reventar una ingesta legítima que
 * sigue en curso en otro dispositivo.
 */
export async function obtenerItemsIngestaHuerfanos(): Promise<ItemIngestaHuerfano[]> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const antes = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ejercicio_ingesta_items")
    .select("id, nombre_archivo, tipo, estado, actualizado_en")
    .in("estado", ["error", "local", "subiendo", "procesando"])
    .lt("actualizado_en", antes)
    .order("actualizado_en", { ascending: true })
    .limit(30);
  if (error) return [];
  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombreArchivo: fila.nombre_archivo,
    tipo: fila.tipo as TipoItemIngesta,
    estado: fila.estado as EstadoItemIngesta,
    actualizadoEn: fila.actualizado_en,
  }));
}
