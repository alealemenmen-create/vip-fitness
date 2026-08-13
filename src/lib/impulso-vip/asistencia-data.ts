import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SolicitudAsistenciaEnVivo = {
  id: string;
  alumnoNombre: string;
  ejercicioNombre: string;
  serieObjetivo: number;
  estado: "pendiente" | "voy";
  solicitadaEn: string;
  venceEn: string;
};

export async function obtenerSolicitudesAsistenciaEnVivo(
  supabase: SupabaseClient<Database>
): Promise<SolicitudAsistenciaEnVivo[]> {
  const { data } = await supabase
    .from("impulso_vip_solicitudes_asistencia")
    .select(
      "id, estado, solicitada_en, vence_en, perfiles!impulso_vip_solicitudes_asistencia_alumno_id_fkey(nombre), impulso_vip_intervenciones(serie_objetivo), sesion_ejercicios(rutina_dia_ejercicios(nombre))"
    )
    .in("estado", ["pendiente", "voy"])
    .gt("vence_en", new Date().toISOString())
    .order("solicitada_en", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    id: string;
    estado: "pendiente" | "voy";
    solicitada_en: string;
    vence_en: string;
    perfiles: { nombre: string } | { nombre: string }[] | null;
    impulso_vip_intervenciones: { serie_objetivo: number } | { serie_objetivo: number }[] | null;
    sesion_ejercicios: {
      rutina_dia_ejercicios: { nombre: string } | { nombre: string }[] | null;
    } | null;
  }>).map((fila) => {
    const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles;
    const intervencion = Array.isArray(fila.impulso_vip_intervenciones)
      ? fila.impulso_vip_intervenciones[0]
      : fila.impulso_vip_intervenciones;
    const asignacionRaw = fila.sesion_ejercicios?.rutina_dia_ejercicios;
    const asignacion = Array.isArray(asignacionRaw) ? asignacionRaw[0] : asignacionRaw;
    return {
      id: fila.id,
      alumnoNombre: perfil?.nombre ?? "Alumno",
      ejercicioNombre: asignacion?.nombre ?? "Ejercicio",
      serieObjetivo: intervencion?.serie_objetivo ?? 0,
      estado: fila.estado,
      solicitadaEn: fila.solicitada_en,
      venceEn: fila.vence_en,
    };
  });
}
