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

export async function obtenerMasV2Action(): Promise<MasDatosV2 | null> {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) return null;
  const supabase = await createClient();
  const [ranking, { data: perfil }] = await Promise.all([
    obtenerRanking("mes"),
    supabase.from("alumno_perfil").select("temporizador_descanso, segundos_descanso_preferido, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana, plan_entrenamiento_pausado").eq("user_id", contexto.alumnoId).maybeSingle(),
  ]);
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
