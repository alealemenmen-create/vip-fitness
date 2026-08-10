import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mesActualISO } from "@/lib/date";
import { resolverPlanEntrenamiento, type CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";

export type EstadoPlanMensual = {
  codigo: CodigoPlanEntrenamiento;
  nombre: string;
  sesionesMensuales: number;
  diasSemana: number;
  consumidas: number;
  restantes: number;
  pausado: boolean;
};

/** Fuente única del cupo. Cuenta cierres del mes calendario y nunca borra
 * sesiones al comenzar otro mes: el reinicio es automático por rango. */
export async function obtenerEstadoPlanMensual(
  db: SupabaseClient,
  alumnoId: string
): Promise<EstadoPlanMensual | null> {
  const { data: perfil } = await db
    .from("alumno_perfil")
    .select("plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana, plan_entrenamiento_pausado")
    .eq("user_id", alumnoId)
    .maybeSingle();

  const plan = resolverPlanEntrenamiento(
    perfil?.plan_entrenamiento,
    perfil?.sesiones_mensuales,
    perfil?.dias_entrenamiento_semana
  );
  if (!plan) return null;

  const { desde, hasta } = mesActualISO();
  // Se cuenta la recompensa inmutable creada en el primer cierre, no el
  // estado editable de la sesión. Así, reabrir para corregir un peso no
  // devuelve artificialmente un cupo que podría usarse para hacer fraude.
  const { data: movimientos } = await db
    .from("puntos_vip_movimientos")
    .select("metadata")
    .eq("alumno_id", alumnoId)
    .eq("categoria", "entrenamiento")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  // Los descansos también tienen un movimiento de entrenamiento para el
  // ranking, pero `total = 0`: se excluyen del cupo comercial.
  const consumidas = (movimientos ?? []).filter((movimiento) => {
    const metadata = movimiento.metadata as Record<string, unknown> | null;
    return Number(metadata?.total ?? 0) > 0;
  }).length;
  return {
    codigo: plan.codigo,
    nombre: plan.nombre,
    sesionesMensuales: plan.sesionesMensuales,
    diasSemana: plan.diasSemana,
    consumidas,
    restantes: Math.max(0, plan.sesionesMensuales - consumidas),
    pausado: perfil?.plan_entrenamiento_pausado ?? false,
  };
}
