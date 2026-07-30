"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import type { TipoDocumento } from "@/lib/supabase/types";

const TAMANO_MAXIMO_PDF = 15 * 1024 * 1024; // 15 MB

/** Todas las pantallas que muestran documentos, para refrescarlas juntas. */
function refrescarVistas(alumnoIds: string[] = []) {
  revalidatePath("/admin/documentos");
  revalidatePath("/alumno/documentos");
  revalidatePath("/alumno/comer");
  for (const id of alumnoIds) revalidatePath(`/admin/alumnos/${id}`);
}

export type SubirYAsignarState = {
  error: string | null;
  /** Ruta en Storage, para poder analizarlo con IA sin volver a subirlo. */
  storagePath: string | null;
  documentoId: string | null;
  asignados: number;
};

const vacio: SubirYAsignarState = {
  error: null,
  storagePath: null,
  documentoId: null,
  asignados: 0,
};

/**
 * Sube UN archivo y lo asigna a los alumnos elegidos en una sola acción.
 *
 * El archivo va una sola vez a Storage y una sola fila a `documentos`; a quién
 * se le asigna vive en `documento_asignaciones` (migración 0027). Antes, el
 * mismo PDF para 10 alumnos significaba entrar 10 veces a 10 perfiles y subirlo
 * 10 veces.
 *
 * Se puede subir sin asignar a nadie: queda en la biblioteca para asignarlo
 * después.
 */
export async function subirYAsignarDocumento(
  _prevState: SubirYAsignarState,
  formData: FormData
): Promise<SubirYAsignarState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const fallo = (error: string): SubirYAsignarState => ({ ...vacio, error });

  const file = formData.get("archivo") as File | null;
  const tipo = String(formData.get("tipo") || "") as TipoDocumento;
  const alumnoIds = formData.getAll("alumno_ids").map(String).filter(Boolean);

  if (!file || file.size === 0) return fallo("Selecciona un archivo PDF.");
  if (file.type !== "application/pdf") return fallo("Solo se aceptan archivos PDF.");
  if (file.size > TAMANO_MAXIMO_PDF) {
    return fallo("El archivo supera el tamaño máximo permitido (15 MB).");
  }
  if (!["rutina", "alimentacion", "otro"].includes(tipo)) {
    return fallo("Elige si es rutina, alimentación u otro documento.");
  }

  // Los archivos de la biblioteca no cuelgan de ningún alumno: van a una
  // carpeta común, porque el mismo archivo puede terminar asignado a varios.
  const storagePath = `biblioteca/${tipo}-${Date.now()}.pdf`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: "application/pdf" });

  if (errorSubida) {
    return fallo("No fue posible subir el archivo. Revisa tu conexión e intenta nuevamente.");
  }

  const { data: documento, error: errorDocumento } = await supabase
    .from("documentos")
    .insert({
      tipo,
      nombre_archivo: file.name,
      storage_path: storagePath,
      entrenador_id: sesion.userId,
    })
    .select("id")
    .single();

  if (errorDocumento || !documento) {
    // Sin fila, el archivo quedaría huérfano en Storage: invisible y sin forma
    // de borrarlo desde la app.
    await supabase.storage.from("documentos").remove([storagePath]);
    return fallo("El archivo se subió, pero no fue posible registrarlo. Intenta nuevamente.");
  }

  if (alumnoIds.length > 0) {
    const { error: errorAsignar } = await supabase.from("documento_asignaciones").insert(
      alumnoIds.map((alumnoId) => ({
        documento_id: documento.id,
        alumno_id: alumnoId,
        asignado_por: sesion.userId,
      }))
    );

    if (errorAsignar) {
      // El archivo ya está en la biblioteca; solo falló el reparto. Se avisa
      // sin borrar nada, para que pueda reintentar la asignación sin volver a
      // subir el PDF.
      return {
        ...vacio,
        storagePath,
        documentoId: documento.id,
        error: "El archivo se guardó, pero no fue posible asignarlo. Asígnalo desde la biblioteca.",
      };
    }
  }

  refrescarVistas(alumnoIds);
  return {
    error: null,
    storagePath,
    documentoId: documento.id,
    asignados: alumnoIds.length,
  };
}

export type AccionState = { error: string | null; ok: boolean };

/** Suma alumnos a un documento que ya está en la biblioteca. */
export async function asignarDocumento(
  documentoId: string,
  alumnoIds: string[]
): Promise<AccionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  if (alumnoIds.length === 0) return { error: "Elige al menos un alumno.", ok: false };

  // `upsert` en vez de `insert`: reasignar a alguien que ya lo tiene no es un
  // error, simplemente no cambia nada.
  const { error } = await supabase.from("documento_asignaciones").upsert(
    alumnoIds.map((alumnoId) => ({
      documento_id: documentoId,
      alumno_id: alumnoId,
      asignado_por: sesion.userId,
    })),
    { onConflict: "documento_id,alumno_id" }
  );

  if (error) return { error: "No fue posible asignar el documento.", ok: false };

  refrescarVistas(alumnoIds);
  return { error: null, ok: true };
}

/** Quita el documento a uno o varios alumnos. El archivo queda intacto. */
export async function quitarAsignacion(
  documentoId: string,
  alumnoIds: string[]
): Promise<AccionState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  if (alumnoIds.length === 0) return { error: null, ok: true };

  const { error } = await supabase
    .from("documento_asignaciones")
    .delete()
    .eq("documento_id", documentoId)
    .in("alumno_id", alumnoIds);

  if (error) return { error: "No fue posible quitar la asignación.", ok: false };

  refrescarVistas(alumnoIds);
  return { error: null, ok: true };
}

/**
 * Reemplaza el archivo de un documento conservando sus asignaciones — el caso
 * de "actualicé la rutina de este mes y va para los mismos alumnos".
 */
export async function reemplazarArchivo(
  _prevState: AccionState,
  formData: FormData
): Promise<AccionState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const documentoId = String(formData.get("documento_id") || "");
  const file = formData.get("archivo") as File | null;

  if (!documentoId) return { error: "Falta el documento a reemplazar.", ok: false };
  if (!file || file.size === 0) return { error: "Selecciona un archivo PDF.", ok: false };
  if (file.type !== "application/pdf") return { error: "Solo se aceptan archivos PDF.", ok: false };
  if (file.size > TAMANO_MAXIMO_PDF) {
    return { error: "El archivo supera el tamaño máximo permitido (15 MB).", ok: false };
  }

  const { data: actual } = await supabase
    .from("documentos")
    .select("storage_path, tipo, version")
    .eq("id", documentoId)
    .maybeSingle();

  if (!actual) return { error: "El documento ya no existe.", ok: false };

  const nuevoPath = `biblioteca/${actual.tipo}-${Date.now()}.pdf`;
  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(nuevoPath, await file.arrayBuffer(), { contentType: "application/pdf" });

  if (errorSubida) return { error: "No fue posible subir el archivo nuevo.", ok: false };

  const { error: errorUpdate } = await supabase
    .from("documentos")
    .update({
      storage_path: nuevoPath,
      nombre_archivo: file.name,
      version: (actual.version ?? 1) + 1,
    })
    .eq("id", documentoId);

  if (errorUpdate) {
    await supabase.storage.from("documentos").remove([nuevoPath]);
    return { error: "No fue posible reemplazar el archivo.", ok: false };
  }

  // Recién ahora se borra el viejo: si algo falló antes, el documento seguía
  // apuntando a un archivo que existe.
  await supabase.storage.from("documentos").remove([actual.storage_path]);

  refrescarVistas();
  return { error: null, ok: true };
}

/**
 * Borra el documento de la biblioteca y su archivo. Las asignaciones caen solas
 * por la clave foránea en cascada.
 *
 * El archivo solo se elimina si ninguna otra fila lo referencia: una guía
 * completa se registra dos veces (rutina y alimentación) sobre el mismo archivo
 * — ver `subirGuiaCompleta`.
 */
export async function eliminarDocumentoBiblioteca(documentoId: string): Promise<AccionState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: documento } = await supabase
    .from("documentos")
    .select("storage_path")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { error: null, ok: true };

  const { error } = await supabase.from("documentos").delete().eq("id", documentoId);
  if (error) return { error: "No fue posible eliminar el documento.", ok: false };

  const { count } = await supabase
    .from("documentos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", documento.storage_path);

  if ((count ?? 0) === 0) {
    await supabase.storage.from("documentos").remove([documento.storage_path]);
  }

  refrescarVistas();
  return { error: null, ok: true };
}
