import type { createClient } from "@/lib/supabase/server";
import { obtenerHistorialSesiones, type SesionHistorial } from "@/app/alumno/entrenar/data";
import { obtenerResumenComidas, type ResumenDiaComidas } from "@/app/alumno/comer/data";
import { obtenerMovimientosAlumno } from "@/lib/ranking/data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DiaHistorial = {
  fecha: string;
  sesion: SesionHistorial | null;
  comida: ResumenDiaComidas;
  puntos: number;
};

/** Combina, para los últimos `dias`, lo que ya existe por separado en
 * Entrenar (`obtenerHistorialSesiones`), Nutrición (`obtenerResumenComidas`)
 * y Puntos VIP (`obtenerMovimientosAlumno`) — no crea ninguna consulta
 * pesada nueva, solo los junta por fecha para la pantalla "Mi Historial".
 * Los días sin ninguna actividad (sin sesión, sin comida registrada, sin
 * puntos) se descartan para no llenar el historial de filas vacías. */
export async function obtenerHistorialCombinado(
  supabase: SupabaseServerClient,
  alumnoId: string,
  dias = 30
): Promise<DiaHistorial[]> {
  const [sesiones, comidas, movimientos] = await Promise.all([
    obtenerHistorialSesiones(supabase, alumnoId, 60),
    obtenerResumenComidas(supabase, alumnoId, dias),
    obtenerMovimientosAlumno(alumnoId, 120),
  ]);

  const sesionesPorFecha = new Map(sesiones.map((s) => [s.fecha, s]));
  const puntosPorFecha = new Map<string, number>();
  for (const m of movimientos) {
    puntosPorFecha.set(m.fecha, (puntosPorFecha.get(m.fecha) ?? 0) + m.puntos);
  }

  return comidas
    .map((comida) => ({
      fecha: comida.fecha,
      sesion: sesionesPorFecha.get(comida.fecha) ?? null,
      comida,
      puntos: puntosPorFecha.get(comida.fecha) ?? 0,
    }))
    .filter((dia) => dia.sesion !== null || dia.comida.estado !== "vacio" || dia.puntos !== 0);
}
