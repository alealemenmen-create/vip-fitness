"use server";

import { obtenerSesionActualOpcional, type SesionActual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { progresoAlSiguiente, rangoDePuntos } from "@/lib/ranking/puntos";
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
  tienePerfilAlumno: boolean;
};

export type CargaMasV2 =
  | { estado: "demo" }
  | { estado: "real"; datos: MasDatosV2 }
  | { estado: "error"; mensaje: string };

export async function cargarMasV2Action(): Promise<CargaMasV2> {
  const sesion = await obtenerSesionActualOpcional();
  if (!sesion) return { estado: "demo" };
  try {
    const datos = await construirMasV2(sesion);
    return datos
      ? { estado: "real", datos }
      : { estado: "error", mensaje: "No pudimos reconstruir la configuración de esta cuenta." };
  } catch {
    return { estado: "error", mensaje: "No pudimos conectar con tu configuración. Ningún ajuste fue modificado." };
  }
}

async function construirMasV2(sesion: SesionActual): Promise<MasDatosV2> {
  const supabase = await createClient();
  const [{ data: perfil, error: errorPerfil }, { data: movimientos, error: errorPuntos }] = await Promise.all([
    supabase.from("alumno_perfil").select("temporizador_descanso, segundos_descanso_preferido, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana, plan_entrenamiento_pausado").eq("user_id", sesion.userId).maybeSingle(),
    supabase.from("puntos_vip_movimientos").select("puntos").eq("alumno_id", sesion.userId),
  ]);
  if (errorPerfil) throw new Error("No fue posible leer la configuración del alumno.");
  if (errorPuntos) throw new Error("No fue posible leer los Puntos VIP de la cuenta.");
  const tienePerfilAlumno = Boolean(perfil);
  const puntos = tienePerfilAlumno
    ? Math.max(0, (movimientos ?? []).reduce((total, movimiento) => total + movimiento.puntos, 0))
    : 0;
  const rango = rangoDePuntos(puntos);
  const plan = resolverPlanEntrenamiento(perfil?.plan_entrenamiento, perfil?.sesiones_mensuales, perfil?.dias_entrenamiento_semana);
  return {
    nombre: sesion.nombre,
    iniciales: sesion.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "VIP",
    rol: sesion.rol,
    puntos,
    rango: rango.nombre,
    progresoRango: progresoAlSiguiente(puntos)?.pct ?? 100,
    temporizadorActivo: perfil?.temporizador_descanso ?? true,
    descansoPreferido: perfil?.segundos_descanso_preferido ?? null,
    planNombre: plan?.nombre ?? (tienePerfilAlumno ? "Método VIP" : "Perfil personal no activado"),
    planDetalle: plan ? `${plan.sesionesMensuales} sesiones al mes · ${plan.diasSemana} días por semana` : tienePerfilAlumno ? "Entrenamiento, nutrición y seguimiento personalizado" : "Actívalo desde el panel para separar tu entrenamiento de tu trabajo profesional.",
    planActivo: tienePerfilAlumno && perfil?.plan_entrenamiento_pausado !== true,
    soloLectura: false,
    tienePerfilAlumno,
  };
}
