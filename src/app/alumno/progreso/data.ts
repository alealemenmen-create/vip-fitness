import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/date";
import { construirGaleriaSemanal, type SemanaGaleria } from "@/lib/progreso/galeria-semanal";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type RegistroPeso = {
  id: string;
  pesoKg: number;
  fecha: string;
  observacion: string | null;
  registradoPorNombre: string;
};

export async function obtenerHistorialPeso(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<RegistroPeso[]> {
  const { data } = await supabase
    .from("pesos_corporales")
    .select("id, peso_kg, fecha, observacion, registrado_por, perfiles!pesos_corporales_registrado_por_fkey(nombre)")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    pesoKg: p.peso_kg,
    fecha: p.fecha,
    observacion: p.observacion,
    registradoPorNombre:
      (p.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Desconocido",
  }));
}

export type FotoProgreso = {
  id: string;
  fechaFoto: string;
  fechaCarga: string;
  url: string | null;
  storagePath: string;
};

export async function obtenerFotosProgreso(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<FotoProgreso[]> {
  const { data } = await supabase
    .from("fotos_progreso")
    .select("id, storage_path, fecha_foto, fecha_carga")
    .eq("alumno_id", alumnoId)
    .order("fecha_carga", { ascending: true });

  if (!data || data.length === 0) return [];

  const fotos = await Promise.all(
    data.map(async (f) => {
      const { data: firmada } = await supabase.storage
        .from("fotos-progreso")
        .createSignedUrl(f.storage_path, 60 * 60);
      return {
        id: f.id,
        fechaFoto: f.fecha_foto,
        fechaCarga: f.fecha_carga,
        storagePath: f.storage_path,
        url: firmada?.signedUrl ?? null,
      };
    })
  );

  return fotos;
}

/** La galería, ya organizada en semanas (ver `construirGaleriaSemanal`).
 * Pide las mismas fotos que `obtenerFotosProgreso` — no hay una segunda
 * consulta ni una segunda pasada de URLs firmadas. */
export async function obtenerGaleriaSemanal(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<SemanaGaleria[]> {
  const fotos = await obtenerFotosProgreso(supabase, alumnoId);
  return construirGaleriaSemanal(fotos, hoyISO());
}
