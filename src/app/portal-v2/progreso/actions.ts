"use server";

import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerFotosProgreso, obtenerHistorialPeso } from "@/app/alumno/progreso/data";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import { obtenerRanking } from "@/lib/ranking/data";
import { obtenerAvanceCiclo, obtenerRutinaActiva, obtenerSesionEnProgreso } from "@/app/alumno/entrenar/data";
import { obtenerResumenAlimentacionHoy } from "@/app/alumno/inicio/data";
import { hoyISO } from "@/lib/date";

export type ProgresoDatosV2 = {
  nombre: string;
  fechaHoy: string;
  soloLectura: boolean;
  peso: number | null;
  fechaPeso: string | null;
  variacionPeso: number | null;
  historialPeso: { id: string; fecha: string; pesoKg: number; observacion: string | null }[];
  fotos: { id: string; fecha: string; url: string | null; storagePath: string }[];
  estadisticas: {
    entrenamientos: number;
    diasAlimentacion: number;
    promedioSemanal: number;
    calidadSesiones: number | null;
    impulsosCumplidos: number;
    impulsosEvaluados: number;
    seriesRegistradas: number;
    adherencia: number | null;
  };
  programa: {
    nombre: string;
    sesionActual: number;
    sesionesRealizadas: number;
    sesionesEsperadas: number;
  } | null;
  rango: { nombre: string; imagen: string; puntosAcumulados: number; puntosMes: number; posicion: number } | null;
  clasificacion: { alumnoId: string; nombre: string; puntos: number; posicion: number; esActual: boolean }[];
  hoy: {
    sesionEnProgresoId: string | null;
    comidasRegistradas: number;
    calorias: number;
    proteina: number;
  };
};

export async function obtenerProgresoV2Action(): Promise<ProgresoDatosV2 | null> {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return null;
  const supabase = await createClient();
  const rutina = await obtenerRutinaActiva(contexto.alumnoId);
  const [pesos, fotos, seguimiento, ranking, avance, sesionEnProgresoId, alimentacionHoy] = await Promise.all([
    obtenerHistorialPeso(supabase, contexto.alumnoId),
    obtenerFotosProgreso(supabase, contexto.alumnoId),
    obtenerSeguimientoIntegral(supabase, contexto.alumnoId, 30),
    obtenerRanking("mes"),
    rutina
      ? obtenerAvanceCiclo(supabase, contexto.alumnoId, rutina.id)
      : Promise.resolve({ proximoNumero: 1, ultimoNumeroHecho: 0 }),
    contexto.soloLectura ? Promise.resolve(null) : obtenerSesionEnProgreso(supabase, contexto.alumnoId),
    obtenerResumenAlimentacionHoy(supabase, contexto.alumnoId),
  ]);
  if (!seguimiento) return null;

  const ultimoPeso = pesos.at(-1) ?? null;
  const filaActual = ranking.find((fila) => fila.alumnoId === contexto.alumnoId) ?? null;
  const seriesRegistradas = seguimiento.dias.reduce(
    (total, dia) => total + dia.sesiones.reduce((subtotal, sesion) => subtotal + sesion.seriesRealizadas, 0),
    0,
  );

  return {
    nombre: seguimiento.alumnoNombre,
    fechaHoy: hoyISO(),
    soloLectura: contexto.soloLectura,
    peso: ultimoPeso?.pesoKg ?? seguimiento.evolucion.pesoActual,
    fechaPeso: ultimoPeso?.fecha ?? null,
    variacionPeso: seguimiento.evolucion.variacionPeso,
    historialPeso: pesos.map((registro) => ({
      id: registro.id,
      fecha: registro.fecha,
      pesoKg: registro.pesoKg,
      observacion: registro.observacion,
    })),
    fotos: fotos.map((foto) => ({
      id: foto.id,
      fecha: foto.fechaFoto,
      url: foto.url,
      storagePath: foto.storagePath,
    })),
    estadisticas: {
      entrenamientos: seguimiento.resumen.sesionesRealizadas,
      diasAlimentacion: seguimiento.resumen.diasConAlimentacion,
      promedioSemanal: Math.round((seguimiento.resumen.sesionesRealizadas / (30 / 7)) * 10) / 10,
      calidadSesiones: seguimiento.resumen.calidadSesionesPct,
      impulsosCumplidos: seguimiento.resumen.progresionesCumplidas,
      impulsosEvaluados: seguimiento.resumen.progresionesEvaluadas,
      seriesRegistradas,
      adherencia: seguimiento.resumen.adherenciaGeneral,
    },
    programa: rutina ? {
      nombre: rutina.nombre,
      sesionActual: Math.max(1, avance.ultimoNumeroHecho || avance.proximoNumero),
      sesionesRealizadas: seguimiento.resumen.sesionesRealizadas,
      sesionesEsperadas: seguimiento.resumen.sesionesEsperadas,
    } : null,
    rango: filaActual ? {
      nombre: filaActual.rango.nombre,
      imagen: filaActual.rango.imagen,
      puntosAcumulados: filaActual.puntosAcumulados,
      puntosMes: filaActual.puntos,
      posicion: filaActual.posicion,
    } : null,
    clasificacion: ranking.slice(0, 6).map((fila) => ({
      alumnoId: fila.alumnoId,
      nombre: fila.alumnoId === contexto.alumnoId ? "Tú" : fila.nombre,
      puntos: fila.puntos,
      posicion: fila.posicion,
      esActual: fila.alumnoId === contexto.alumnoId,
    })),
    hoy: {
      sesionEnProgresoId,
      comidasRegistradas: alimentacionHoy.comidasRegistradas,
      calorias: alimentacionHoy.kcal,
      proteina: alimentacionHoy.prot,
    },
  };
}
