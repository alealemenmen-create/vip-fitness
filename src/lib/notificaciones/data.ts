import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificacionEntrenador = {
  id: string;
  tipo: string;
  alumnoNombre: string | null;
  titulo: string;
  cuerpo: string;
  prioridad: "alta" | "normal";
  ruta: string | null;
  leida: boolean;
  creadoEn: string;
};

/** Cuántas notificaciones sin leer tiene el entrenador — para el globito de
 * la campanita. Devuelve 0 sin reventar si la migración 0097 todavía no
 * corrió (mismo criterio que el resto de las tablas nuevas de esta rama). */
export async function contarNotificacionesSinLeer(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notificaciones_entrenador")
    .select("id", { count: "exact", head: true })
    .is("leida_en", null);
  if (error) return 0;
  return count ?? 0;
}

export async function obtenerNotificacionesEntrenador(limite = 60): Promise<NotificacionEntrenador[]> {
  const supabase = await createClient();
  const { data: filas, error } = await supabase
    .from("notificaciones_entrenador")
    .select("id, tipo, alumno_id, titulo, cuerpo, prioridad, ruta, leida_en, creado_en")
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error || !filas) return [];

  const idsAlumnos = [...new Set(filas.map((f) => f.alumno_id).filter((id): id is string => !!id))];
  const { data: perfiles } = idsAlumnos.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsAlumnos)
    : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    alumnoNombre: f.alumno_id ? (nombres.get(f.alumno_id) ?? "Alumno") : null,
    titulo: f.titulo,
    cuerpo: f.cuerpo,
    prioridad: f.prioridad as "alta" | "normal",
    ruta: f.ruta,
    leida: f.leida_en !== null,
    creadoEn: f.creado_en,
  }));
}
