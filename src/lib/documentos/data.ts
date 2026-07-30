import "server-only";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import type { TipoDocumento } from "@/lib/supabase/types";
import type { DocumentoBiblioteca, AlumnoParaAsignar } from "./tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Los tipos y las etiquetas viven en ./tipos, que NO lleva `server-only`, para
// que los componentes cliente puedan importarlos sin arrastrar este módulo (y
// con él el cliente de Supabase) al bundle del navegador. Importarlos desde
// acá sería reexportarlos y volver a crear ese problema.

/**
 * La biblioteca completa del entrenador: cada ARCHIVO una sola vez, con la
 * lista de alumnos que lo tienen asignado.
 *
 * Antes de la migración 0027 esto no se podía consultar: `documentos` guardaba
 * una fila por (archivo, alumno), así que el mismo PDF aparecía repetido y no
 * había forma de preguntar "a quiénes se lo di".
 *
 * Va en una sola consulta con anidado: traer las asignaciones aparte sería un
 * viaje extra de ~95 ms, y con el join no cuesta nada.
 */
export async function obtenerBibliotecaDocumentos(
  supabase: SupabaseServerClient
): Promise<DocumentoBiblioteca[]> {
  const { data } = await supabase
    .from("documentos")
    .select(
      "id, tipo, nombre_archivo, storage_path, fecha_carga, " +
        "documento_asignaciones(alumno_id, fecha_asignacion, perfiles(nombre))"
    )
    .eq("activo", true)
    .order("fecha_carga", { ascending: false });

  type Fila = {
    id: string;
    tipo: TipoDocumento;
    nombre_archivo: string;
    storage_path: string;
    fecha_carga: string;
    documento_asignaciones:
      | {
          alumno_id: string;
          fecha_asignacion: string;
          perfiles: { nombre: string } | { nombre: string }[] | null;
        }[]
      | null;
  };

  return ((data ?? []) as unknown as Fila[]).map((d) => ({
    id: d.id,
    tipo: d.tipo,
    nombreArchivo: d.nombre_archivo,
    storagePath: d.storage_path,
    fechaCarga: d.fecha_carga,
    asignaciones: (d.documento_asignaciones ?? []).map((a) => {
      const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles;
      return {
        alumnoId: a.alumno_id,
        nombre: nombreAlumnoPublicado(perfil?.nombre ?? "Alumno"),
        fechaAsignacion: a.fecha_asignacion,
      };
    }),
  }));
}

/** Los alumnos a los que se le puede asignar un documento. */
export async function obtenerAlumnosParaAsignar(
  supabase: SupabaseServerClient
): Promise<AlumnoParaAsignar[]> {
  const { data } = await supabase
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)")
    .order("user_id");

  type Fila = { user_id: string; perfiles: { nombre: string } | { nombre: string }[] | null };

  return ((data ?? []) as unknown as Fila[])
    .map((a) => {
      const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles;
      return { id: a.user_id, nombre: nombreAlumnoPublicado(perfil?.nombre ?? "Alumno") };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
