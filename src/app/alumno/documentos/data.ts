import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TipoDocumento } from "@/lib/supabase/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type Documento = {
  id: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  fechaAsignacion: string;
  url: string | null;
};

type FilaDocumento = {
  id: string;
  tipo: TipoDocumento;
  nombre_archivo: string;
  storage_path: string;
  fecha_asignacion: string;
};

/**
 * Los documentos que tiene asignados el alumno.
 *
 * Desde la migración 0027 la asignación vive en `documento_asignaciones`, no en
 * `documentos.alumno_id`: el mismo archivo puede estar asignado a varios
 * alumnos sin duplicarse.
 *
 * Si la tabla nueva todavía no existe (el código puede llegar a producción
 * antes que la migración) se cae a la consulta vieja, para que el alumno no se
 * quede sin ver sus documentos en el intervalo.
 */
export async function obtenerDocumentos(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<Documento[]> {
  const filas = await leerAsignados(supabase, alumnoId);

  if (filas.length === 0) return [];

  return Promise.all(
    filas.map(async (d) => {
      const { data: firmada } = await supabase.storage
        .from("documentos")
        .createSignedUrl(d.storage_path, 60 * 60);
      return {
        id: d.id,
        tipo: d.tipo,
        nombreArchivo: d.nombre_archivo,
        fechaAsignacion: d.fecha_asignacion,
        url: firmada?.signedUrl ?? null,
      };
    })
  );
}

async function leerAsignados(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<FilaDocumento[]> {
  const intento = await supabase
    .from("documento_asignaciones")
    .select("fecha_asignacion, documentos!inner(id, tipo, nombre_archivo, storage_path, activo)")
    .eq("alumno_id", alumnoId)
    .order("fecha_asignacion", { ascending: false });

  if (!intento.error) {
    type Fila = {
      fecha_asignacion: string;
      documentos:
        | {
            id: string;
            tipo: TipoDocumento;
            nombre_archivo: string;
            storage_path: string;
            activo: boolean;
          }
        | null;
    };
    return ((intento.data ?? []) as unknown as Fila[])
      .filter((a) => a.documentos?.activo)
      .map((a) => ({
        id: a.documentos!.id,
        tipo: a.documentos!.tipo,
        nombre_archivo: a.documentos!.nombre_archivo,
        storage_path: a.documentos!.storage_path,
        fecha_asignacion: a.fecha_asignacion,
      }));
  }

  // Respaldo: esquema anterior a 0027.
  const { data } = await supabase
    .from("documentos")
    .select("id, tipo, nombre_archivo, storage_path, fecha_asignacion")
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .order("fecha_carga", { ascending: false });

  return (data ?? []) as unknown as FilaDocumento[];
}
