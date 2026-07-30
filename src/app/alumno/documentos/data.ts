import "server-only";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type Documento = {
  id: string;
  tipo: "rutina" | "alimentacion";
  nombreArchivo: string;
  fechaAsignacion: string;
  url: string | null;
};

export async function obtenerDocumentos(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<Documento[]> {
  const { data } = await supabase
    .from("documentos")
    .select("id, tipo, nombre_archivo, storage_path, fecha_asignacion")
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .order("fecha_carga", { ascending: false });

  if (!data || data.length === 0) return [];

  return Promise.all(
    data.map(async (d) => {
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
