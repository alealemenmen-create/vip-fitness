import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO, mesActualISO, semanaActualISO } from "@/lib/date";
import { rangoDePuntos, type DesgloseSemana } from "./puntos";

export const TAG_RANKING = "ranking";
const SEGUNDOS_CACHE_RANKING = 120;

export type PeriodoRanking = "semana" | "mes" | "anio";

export type MovimientoPuntos = {
  id: string;
  categoria: "entrenamiento" | "alimentacion" | "progreso" | "constancia" | "competencia" | "ajuste";
  puntos: number;
  titulo: string;
  detalle: string | null;
  fecha: string;
};

export type FilaRanking = {
  alumnoId: string;
  nombre: string;
  posicion: number;
  puntos: number;
  desglose: DesgloseSemana;
  puntosAcumulados: number;
  rango: ReturnType<typeof rangoDePuntos>;
};

type Alumno = { id: string; nombre: string };
type FilaMovimiento = {
  alumno_id: string;
  categoria: MovimientoPuntos["categoria"];
  puntos: number;
  fecha: string;
};

function rangoPeriodo(periodo: PeriodoRanking): { desde: string; hasta: string } {
  const hoy = hoyISO();
  if (periodo === "semana") {
    const semana = semanaActualISO();
    return { desde: semana[0].fecha, hasta: semana[6].fecha };
  }
  if (periodo === "mes") return mesActualISO();
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: `${hoy.slice(0, 4)}-12-31` };
}

function sumarPorAlumno(filas: FilaMovimiento[]) {
  const total = new Map<string, number>();
  const desglose = new Map<string, DesgloseSemana>();

  for (const fila of filas) {
    total.set(fila.alumno_id, (total.get(fila.alumno_id) ?? 0) + fila.puntos);
    const previo = desglose.get(fila.alumno_id) ?? {
      asistencia: 0,
      alimentacion: 0,
      app: 0,
      total: 0,
      totalCrudo: 0,
    };
    if (fila.categoria === "entrenamiento") previo.asistencia += fila.puntos;
    else if (fila.categoria === "alimentacion") previo.alimentacion += fila.puntos;
    else previo.app += fila.puntos;
    previo.total += fila.puntos;
    previo.totalCrudo += fila.puntos;
    desglose.set(fila.alumno_id, previo);
  }
  return { total, desglose };
}

const calcularRankingCacheado = unstable_cache(
  async (alumnos: Alumno[], periodo: PeriodoRanking): Promise<FilaRanking[]> => {
    const admin = createAdminClient();
    const ids = alumnos.map((a) => a.id);
    const { desde, hasta } = rangoPeriodo(periodo);

    const [{ data: delPeriodo, error: errorPeriodo }, { data: historicos, error: errorHistoricos }] =
      await Promise.all([
        admin
          .from("puntos_vip_movimientos")
          .select("alumno_id, categoria, puntos, fecha")
          .in("alumno_id", ids)
          .gte("fecha", desde)
          .lte("fecha", hasta),
        admin
          .from("puntos_vip_movimientos")
          .select("alumno_id, categoria, puntos, fecha")
          .in("alumno_id", ids),
      ]);

    if (errorPeriodo || errorHistoricos) {
      throw new Error("No fue posible leer Progreso VIP. Aplica la migracion 0034.");
    }

    const periodoSumado = sumarPorAlumno((delPeriodo ?? []) as FilaMovimiento[]);
    const historicoSumado = sumarPorAlumno((historicos ?? []) as FilaMovimiento[]);

    const filas = alumnos.map((alumno) => {
      // Las penalizaciones existen como movimientos auditables, pero nunca
      // crean deuda: tanto el periodo como el acumulado tienen piso en cero.
      const puntos = Math.max(0, periodoSumado.total.get(alumno.id) ?? 0);
      const puntosAcumulados = Math.max(0, historicoSumado.total.get(alumno.id) ?? 0);
      return {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        posicion: 0,
        puntos,
        desglose:
          periodoSumado.desglose.get(alumno.id) ??
          ({ asistencia: 0, alimentacion: 0, app: 0, total: 0, totalCrudo: 0 } satisfies DesgloseSemana),
        puntosAcumulados,
        rango: rangoDePuntos(puntosAcumulados),
      };
    });

    filas.sort((a, b) => b.puntos - a.puntos || b.puntosAcumulados - a.puntosAcumulados || a.nombre.localeCompare(b.nombre));
    filas.forEach((fila, indice) => (fila.posicion = indice + 1));
    return filas;
  },
  ["progreso-vip-ranking"],
  { revalidate: SEGUNDOS_CACHE_RANKING, tags: [TAG_RANKING] }
);

async function obtenerAlumnos(): Promise<Alumno[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)");

  return (data ?? [])
    .map((a) => ({
      id: a.user_id,
      nombre: (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function obtenerRanking(periodo: PeriodoRanking = "semana"): Promise<FilaRanking[]> {
  const alumnos = await obtenerAlumnos();
  if (alumnos.length === 0) return [];
  return calcularRankingCacheado(alumnos, periodo);
}

export async function obtenerRankingSemanal(): Promise<FilaRanking[]> {
  return obtenerRanking("semana");
}

export async function obtenerMovimientosAlumno(alumnoId: string, limite = 12): Promise<MovimientoPuntos[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("puntos_vip_movimientos")
    .select("id, categoria, puntos, titulo, detalle, fecha")
    .eq("alumno_id", alumnoId)
    .neq("puntos", 0)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error("No fue posible leer el historial de Puntos VIP.");
  return (data ?? []) as MovimientoPuntos[];
}
