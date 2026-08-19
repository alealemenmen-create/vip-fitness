import "server-only";

import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerNoticias } from "@/lib/noticias/data";
import { obtenerRanking } from "@/lib/ranking/data";
import { obtenerTorneosPublicos } from "@/lib/torneos/data";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";

export type FilaComunidadV2 = {
  alumnoId: string;
  nombre: string;
  iniciales: string;
  puntos: number;
  puesto: number;
  esActual: boolean;
};

export type ActividadComunidadV2 = {
  id: string;
  titulo: string;
  detalle: string;
  nombre: string;
  fecha: string;
  tipo: string;
};

export type ComunidadDatosV2 = {
  nombre: string;
  iniciales: string;
  posicionMes: number | null;
  puntosMes: number;
  impulsos: number;
  sesiones: number;
  soloLectura: boolean;
  general: FilaComunidadV2[];
  mensual: FilaComunidadV2[];
  actividad: ActividadComunidadV2[];
  retos: { id: string; nombre: string; descripcion: string | null; fechaInicio: string; fechaFin: string; regla: string | null; modalidad: string; puntos: number; participantes: number; miEstado: string | null }[];
};

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "VIP";
}

export async function obtenerComunidadV2(): Promise<ComunidadDatosV2 | null> {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return null;
  const supabase = await createClient();

  const [rankingMes, noticiasPorMes, torneos, seguimiento] = await Promise.all([
    obtenerRanking("mes"),
    obtenerNoticias(supabase, 3),
    obtenerTorneosPublicos(contexto.alumnoId),
    obtenerSeguimientoIntegral(supabase, contexto.alumnoId, 30),
  ]);

  const mensual = rankingMes.map((fila) => ({
    alumnoId: fila.alumnoId,
    nombre: fila.alumnoId === contexto.alumnoId ? "Tú" : fila.nombre,
    iniciales: iniciales(fila.nombre),
    puntos: fila.puntos,
    puesto: fila.posicion,
    esActual: fila.alumnoId === contexto.alumnoId,
  }));

  const ordenGeneral = [...rankingMes]
    .sort((a, b) => b.puntosAcumulados - a.puntosAcumulados || a.nombre.localeCompare(b.nombre, "es"));
  const general = ordenGeneral.map((fila, indice) => ({
    alumnoId: fila.alumnoId,
    nombre: fila.alumnoId === contexto.alumnoId ? "Tú" : fila.nombre,
    iniciales: iniciales(fila.nombre),
    puntos: fila.puntosAcumulados,
    puesto: indice + 1,
    esActual: fila.alumnoId === contexto.alumnoId,
  }));

  const actividad = [...noticiasPorMes.values()]
    .flat()
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.relevancia - a.relevancia)
    .slice(0, 12)
    .map((noticia) => ({
      id: noticia.id,
      titulo: noticia.titular,
      detalle: noticia.detalle,
      nombre: noticia.alumnoNombre,
      fecha: noticia.fecha,
      tipo: noticia.tipo,
    }));

  const propia = rankingMes.find((fila) => fila.alumnoId === contexto.alumnoId);
  return {
    nombre: seguimiento?.alumnoNombre ?? propia?.nombre ?? "Alumno VIP",
    iniciales: iniciales(seguimiento?.alumnoNombre ?? propia?.nombre ?? "Alumno VIP"),
    posicionMes: propia?.posicion ?? null,
    puntosMes: propia?.puntos ?? 0,
    impulsos: seguimiento?.resumen.progresionesCumplidas ?? 0,
    sesiones: seguimiento?.resumen.sesionesRealizadas ?? 0,
    soloLectura: contexto.soloLectura,
    general,
    mensual,
    actividad,
    retos: torneos.slice(0, 6).map((torneo) => ({
      id: torneo.id,
      nombre: torneo.nombre,
      descripcion: torneo.descripcion,
      fechaInicio: torneo.fechaInicio,
      fechaFin: torneo.fechaFin,
      regla: torneo.reglaPublica,
      modalidad: torneo.modalidad,
      puntos: torneo.puntosEnJuego,
      participantes: torneo.participantes.filter((participante) => participante.estado === "aceptado").length,
      miEstado: torneo.miEstado,
    })),
  };
}
