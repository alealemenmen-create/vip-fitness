"use server";

import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerRanking } from "@/lib/ranking/data";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";

export type MasDatosV2 = {
  nombre: string;
  iniciales: string;
  rol: "alumno" | "entrenador" | "admin";
  puntos: number;
  rango: string;
  progresoRango: number;
  temporizadorActivo: boolean;
  descansoPreferido: number | null;
  planNombre: string;
  planDetalle: string;
  planActivo: boolean;
  soloLectura: boolean;
};

export type CargaMasV2 =
  | { estado: "demo" }
  | { estado: "real"; datos: MasDatosV2 }
  | { estado: "error"; mensaje: string };

type ContextoAlumnoV2 = NonNullable<Awaited<ReturnType<typeof obtenerContextoAlumnoOpcional>>>;

export async function cargarMasV2Action(): Promise<CargaMasV2> {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return { estado: "demo" };
  try {
    const datos = await construirMasV2(contexto);
    return datos
      ? { estado: "real", datos }
      : { estado: "error", mensaje: "No pudimos reconstruir la configuración de esta cuenta." };
  } catch {
    return { estado: "error", mensaje: "No pudimos conectar con tu configuración. Ningún ajuste fue modificado." };
  }
}

async function construirMasV2(contexto: ContextoAlumnoV2): Promise<MasDatosV2> {
  const supabase = await createClient();
  const [ranking, { data: perfil, error: errorPerfil }] = await Promise.all([
    obtenerRanking("mes"),
    supabase.from("alumno_perfil").select("temporizador_descanso, segundos_descanso_preferido, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana, plan_entrenamiento_pausado").eq("user_id", contexto.alumnoId).maybeSingle(),
  ]);
  if (errorPerfil) throw new Error("No fue posible leer la configuración del alumno.");
  const fila = ranking.find((item) => item.alumnoId === contexto.alumnoId);
  const puntos = fila?.puntosAcumulados ?? 0;
  const plan = resolverPlanEntrenamiento(perfil?.plan_entrenamiento, perfil?.sesiones_mensuales, perfil?.dias_entrenamiento_semana);
  return {
    nombre: contexto.nombre,
    iniciales: contexto.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "VIP",
    rol: contexto.rolSesion,
    puntos,
    rango: fila?.rango.nombre ?? "Bronze",
    progresoRango: progresoAlSiguiente(puntos)?.pct ?? 100,
    temporizadorActivo: perfil?.temporizador_descanso ?? true,
    descansoPreferido: perfil?.segundos_descanso_preferido ?? null,
    planNombre: plan?.nombre ?? "Método VIP",
    planDetalle: plan ? `${plan.sesionesMensuales} sesiones al mes · ${plan.diasSemana} días por semana` : "Entrenamiento, nutrición y seguimiento personalizado",
    planActivo: perfil?.plan_entrenamiento_pausado !== true,
    soloLectura: contexto.soloLectura,
  };
}
