import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInTimeZone } from "date-fns-tz";
import { ZONA_HORARIA_VIP, hoyISO } from "@/lib/date";
import type { TorneoAdmin, TorneoPublico, ResultadoHistorico } from "./types";
import type { ResultadoTorneo } from "./puntos";
import { calcularValoresCompetencia } from "./metricas";
import { apuestasAbiertas, obtenerResumenApuestas } from "./apuestas-data";

export type { TorneoMetrica, TorneoAdmin, TorneoPublico, ResultadoHistorico } from "./types";
export { NOMBRE_METRICA, NOMBRE_MODALIDAD } from "./types";
type AdminClient = ReturnType<typeof createAdminClient>;

export type CelebracionTorneo = {
  torneoId: string;
  nombre: string;
  puntosGanados: number;
};

async function obtenerNombres(admin: AdminClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.from("perfiles").select("id, nombre").in("id", ids);
  if (error) throw new Error("No fue posible leer los participantes de la Arena VIP.");
  return new Map((data ?? []).map((p) => [p.id, p.nombre]));
}

/** Torneo cerrado hoy en Chile que ganó el alumno. Se usa para mostrar una
 * celebración una sola vez en el dispositivo cuando vuelve a entrar. */
export async function obtenerCelebracionTorneoHoy(
  alumnoId: string
): Promise<CelebracionTorneo | null> {
  const admin = createAdminClient();
  const { data: torneos } = await admin
    .from("torneos")
    .select("id, nombre, cerrado_en, torneo_resultados(resultados)")
    .eq("cerrado", true)
    .not("cerrado_en", "is", null)
    .order("cerrado_en", { ascending: false })
    .limit(20);

  for (const torneo of torneos ?? []) {
    if (
      !torneo.cerrado_en ||
      formatInTimeZone(new Date(torneo.cerrado_en), ZONA_HORARIA_VIP, "yyyy-MM-dd") !== hoyISO()
    ) {
      continue;
    }

    const bruto = torneo.torneo_resultados as unknown;
    const snapshot = Array.isArray(bruto) ? bruto[0] : bruto;
    const resultados = (snapshot as { resultados?: ResultadoTorneo[] } | null)?.resultados ?? [];
    const ganador = resultados.find(
      (resultado) => resultado.alumnoId === alumnoId && resultado.puesto === 1
    );
    if (!ganador) continue;

    return {
      torneoId: torneo.id,
      nombre: torneo.nombre,
      puntosGanados: Math.max(0, ganador.puntosDelta),
    };
  }

  return null;
}

/** Todos los torneos con sus participantes y resultado (si ya cerró) — para
 * el panel del entrenador. */
export async function obtenerTorneosAdmin(): Promise<TorneoAdmin[]> {
  const admin = createAdminClient();
  const { data: torneos } = await admin
    .from("torneos")
    .select("*")
    .order("created_at", { ascending: false });

  if (!torneos || torneos.length === 0) return [];

  const torneoIds = torneos.map((t) => t.id);
  const [{ data: participantes }, { data: resultadosCerrados }, { data: apuestas }] = await Promise.all([
    admin
      .from("torneo_participantes")
      .select("torneo_id, alumno_id, resultado_manual, estado")
      .in("torneo_id", torneoIds),
    admin.from("torneo_resultados").select("torneo_id, resultados").in("torneo_id", torneoIds),
    admin
      .from("torneo_apuestas")
      .select("torneo_id, por_alumno_id, puntos, devuelto")
      .in("torneo_id", torneoIds),
  ]);

  /** Agrupa las apuestas de un torneo por el competidor al que respaldan. */
  const apuestasDe = (torneoId: string) => {
    const suyas = (apuestas ?? []).filter((a) => a.torneo_id === torneoId);
    const porParticipante: { alumnoId: string; total: number; cantidad: number }[] = [];
    for (const apuesta of suyas) {
      const fila = porParticipante.find((p) => p.alumnoId === apuesta.por_alumno_id);
      if (fila) {
        fila.total += apuesta.puntos;
        fila.cantidad += 1;
      } else {
        porParticipante.push({ alumnoId: apuesta.por_alumno_id, total: apuesta.puntos, cantidad: 1 });
      }
    }
    return {
      total: suyas.reduce((total, a) => total + a.puntos, 0),
      cantidad: suyas.length,
      porParticipante,
      resueltas: suyas.length > 0 && suyas.every((a) => a.devuelto !== null),
    };
  };

  const nombres = await obtenerNombres(
    admin,
    [...new Set((participantes ?? []).map((p) => p.alumno_id))]
  );
  const resultadosPorTorneo = new Map((resultadosCerrados ?? []).map((r) => [r.torneo_id, r.resultados]));

  return torneos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion,
    metrica: t.metrica,
    modalidad: t.modalidad,
    reglaPublica: t.regla_publica,
    menorEsMejor: t.menor_es_mejor,
    unidadManual: t.unidad_manual,
    fechaInicio: t.fecha_inicio,
    fechaFin: t.fecha_fin,
    puntosEnJuego: t.puntos_en_juego,
    cerrado: t.cerrado,
    apuestas: apuestasDe(t.id),
    participantes: (participantes ?? [])
      .filter((p) => p.torneo_id === t.id)
      .map((p) => ({
        alumnoId: p.alumno_id,
        nombre: nombres.get(p.alumno_id) ?? "Alumno",
        resultadoManual: p.resultado_manual,
        estado: p.estado,
      })),
    resultados: resultadosPorTorneo.get(t.id) ?? null,
  }));
}

/**
 * TODOS los torneos abiertos (no cerrados), para cualquier alumno — se
 * publican como noticia pública apenas se crean, no hace falta que lo
 * acepten para que se sepa que existen. `miEstado` viene null si el alumno
 * que pregunta no fue invitado (lo ve como espectador); si no es null, la UI
 * le muestra los botones de aceptar/rechazar mientras esté en 'pendiente'.
 */
export async function obtenerTorneosPublicos(alumnoId: string): Promise<TorneoPublico[]> {
  const admin = createAdminClient();
  const { data: torneos, error: errorTorneos } = await admin
    .from("torneos")
    .select("*")
    .eq("cerrado", false)
    .order("fecha_inicio", { ascending: true });

  if (errorTorneos) throw new Error("No fue posible leer los desafíos de la Arena VIP.");

  if (!torneos || torneos.length === 0) return [];

  const { data: todosParticipantes, error: errorParticipantes } = await admin
    .from("torneo_participantes")
    .select("torneo_id, alumno_id, estado, resultado_manual")
    .in(
      "torneo_id",
      torneos.map((t) => t.id)
    );

  if (errorParticipantes) throw new Error("No fue posible leer los participantes de la Arena VIP.");

  const [nombres, apuestas] = await Promise.all([
    obtenerNombres(admin, [...new Set((todosParticipantes ?? []).map((p) => p.alumno_id))]),
    obtenerResumenApuestas(torneos.map((t) => t.id), alumnoId),
  ]);

  const marcadores = new Map<string, Awaited<ReturnType<typeof calcularValoresCompetencia>>>();
  await Promise.all(
    torneos.map(async (torneo) => {
      const aceptados = (todosParticipantes ?? [])
        .filter((participante) => participante.torneo_id === torneo.id && participante.estado === "aceptado")
        .map((participante) => ({
          alumnoId: participante.alumno_id,
          resultadoManual: participante.resultado_manual,
        }));
      marcadores.set(
        torneo.id,
        await calcularValoresCompetencia(
          admin,
          torneo.metrica,
          torneo.fecha_inicio,
          torneo.fecha_fin,
          aceptados
        )
      );
    })
  );

  return torneos.map((t) => {
    const marcador = marcadores.get(t.id) ?? new Map();
    const participantes = (todosParticipantes ?? [])
      .filter((p) => p.torneo_id === t.id)
      .map((p) => {
        const medicion = marcador.get(p.alumno_id);
        return {
          alumnoId: p.alumno_id,
          nombre: nombres.get(p.alumno_id) ?? "Alumno",
          estado: p.estado,
          valorActual: medicion?.valor ?? null,
          resultadoValido: medicion?.valido ?? false,
        };
      });
    const propia = participantes.find((p) => p.alumnoId === alumnoId);

    return {
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      metrica: t.metrica,
      modalidad: t.modalidad,
      reglaPublica: t.regla_publica,
      menorEsMejor: t.menor_es_mejor,
      unidadManual: t.unidad_manual,
      fechaInicio: t.fecha_inicio,
      horaInicio: t.hora_inicio,
      fechaFin: t.fecha_fin,
      horaFin: t.hora_fin,
      puntosEnJuego: t.puntos_en_juego,
      participantes,
      miEstado: propia?.estado ?? null,
      apuestas: {
        abiertas: apuestasAbiertas(t),
        total: apuestas.get(t.id)?.total ?? 0,
        cantidad: apuestas.get(t.id)?.cantidad ?? 0,
        porParticipante: apuestas.get(t.id)?.porParticipante ?? [],
        miApuesta: apuestas.get(t.id)?.miApuesta ?? null,
      },
    };
  });
}

/** Torneos ya cerrados con su resultado — noticias públicas para Ranked,
 * las ve cualquier alumno. */
export async function obtenerHistorialTorneos(): Promise<ResultadoHistorico[]> {
  const admin = createAdminClient();
  const { data: torneos } = await admin
    .from("torneos")
    .select("id, nombre, metrica, modalidad, fecha_fin")
    .eq("cerrado", true)
    .order("cerrado_en", { ascending: false })
    .limit(20);

  if (!torneos || torneos.length === 0) return [];

  const { data: resultados } = await admin
    .from("torneo_resultados")
    .select("torneo_id, resultados, cerrada_en")
    .in(
      "torneo_id",
      torneos.map((t) => t.id)
    );

  const resultadosPorTorneo = new Map((resultados ?? []).map((r) => [r.torneo_id, r]));

  const historial: ResultadoHistorico[] = [];
  for (const t of torneos) {
    const r = resultadosPorTorneo.get(t.id);
    if (!r) continue;
    historial.push({
      torneoId: t.id,
      nombre: t.nombre,
      metrica: t.metrica,
      modalidad: t.modalidad,
      fechaFin: t.fecha_fin,
      cerradoEn: r.cerrada_en,
      resultados: r.resultados,
    });
  }
  return historial;
}
