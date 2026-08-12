import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO } from "@/lib/date";
import { estadoVencimiento, type CicloGasto, type EstadoGasto } from "./calendario";

export type MonedaGasto = "CLP" | "USD" | "EUR";

export type GastoApp = {
  id: string;
  nombre: string;
  categoria: string;
  usoApp: string | null;
  proveedor: string | null;
  plan: string | null;
  montoEstimado: number | null;
  moneda: MonedaGasto;
  ciclo: CicloGasto;
  proximaFecha: string | null;
  avisarDiasAntes: number;
  enlacePanel: string | null;
  notas: string | null;
  activo: boolean;
  estado: EstadoGasto;
  dias: number | null;
};

export type PagoGasto = {
  id: string;
  gastoId: string;
  gastoNombre: string;
  fechaPago: string;
  montoReal: number | null;
  moneda: MonedaGasto;
  periodoVencimiento: string | null;
  nota: string | null;
};

type FilaGasto = {
  id: string; nombre: string; categoria: string; uso_app: string | null; proveedor: string | null;
  plan: string | null; monto_estimado: number | string | null; moneda: MonedaGasto; ciclo: CicloGasto;
  proxima_fecha: string | null; avisar_dias_antes: number; enlace_panel: string | null; notas: string | null; activo: boolean;
};
type FilaPago = {
  id: string; gasto_id: string; fecha_pago: string; monto_real: number | string | null;
  moneda: MonedaGasto; periodo_vencimiento: string | null; nota: string | null;
  gastos_app: { nombre: string } | Array<{ nombre: string }> | null;
};

function dbSinTipos(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

function mapearGasto(fila: FilaGasto, hoy: string): GastoApp {
  const vencimiento = estadoVencimiento(fila.proxima_fecha, fila.avisar_dias_antes, hoy);
  return {
    id: fila.id, nombre: fila.nombre, categoria: fila.categoria, usoApp: fila.uso_app,
    proveedor: fila.proveedor, plan: fila.plan,
    montoEstimado: fila.monto_estimado === null ? null : Number(fila.monto_estimado),
    moneda: fila.moneda, ciclo: fila.ciclo, proximaFecha: fila.proxima_fecha,
    avisarDiasAntes: fila.avisar_dias_antes, enlacePanel: fila.enlace_panel, notas: fila.notas,
    activo: fila.activo, estado: vencimiento.estado, dias: vencimiento.dias,
  };
}

export async function obtenerGastosApp(): Promise<{
  disponible: boolean;
  gastos: GastoApp[];
  pagos: PagoGasto[];
}> {
  const db = dbSinTipos();
  const [{ data: gastos, error: errorGastos }, { data: pagos, error: errorPagos }] = await Promise.all([
    db.from("gastos_app").select("id,nombre,categoria,uso_app,proveedor,plan,monto_estimado,moneda,ciclo,proxima_fecha,avisar_dias_antes,enlace_panel,notas,activo").order("activo", { ascending: false }).order("proxima_fecha", { ascending: true, nullsFirst: false }),
    db.from("gastos_app_pagos").select("id,gasto_id,fecha_pago,monto_real,moneda,periodo_vencimiento,nota,gastos_app(nombre)").order("fecha_pago", { ascending: false }).limit(100),
  ]);
  if (errorGastos || errorPagos) {
    const faltaTabla = [errorGastos, errorPagos].some((error) => error?.code === "PGRST205" || error?.code === "42P01");
    if (!faltaTabla) console.error("[gastos] no se pudo leer el control:", errorGastos?.message ?? errorPagos?.message);
    return { disponible: false, gastos: [], pagos: [] };
  }
  const hoy = hoyISO();
  return {
    disponible: true,
    gastos: ((gastos ?? []) as FilaGasto[]).map((fila) => mapearGasto(fila, hoy)),
    pagos: ((pagos ?? []) as unknown as FilaPago[]).map((fila) => ({
      id: fila.id,
      gastoId: fila.gasto_id,
      gastoNombre: Array.isArray(fila.gastos_app) ? (fila.gastos_app[0]?.nombre ?? "Servicio") : (fila.gastos_app?.nombre ?? "Servicio"),
      fechaPago: fila.fecha_pago,
      montoReal: fila.monto_real === null ? null : Number(fila.monto_real),
      moneda: fila.moneda,
      periodoVencimiento: fila.periodo_vencimiento,
      nota: fila.nota,
    })),
  };
}

export async function obtenerResumenAlertasGastos(): Promise<{
  pendientes: number;
  vencidos: number;
}> {
  const db = dbSinTipos();
  const { data, error } = await db.from("gastos_app").select("proxima_fecha,avisar_dias_antes").eq("activo", true);
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") console.error("[gastos] no se pudieron leer alertas:", error.message);
    return { pendientes: 0, vencidos: 0 };
  }
  const hoy = hoyISO();
  const estados = ((data ?? []) as { proxima_fecha: string | null; avisar_dias_antes: number }[])
    .map((fila) => estadoVencimiento(fila.proxima_fecha, fila.avisar_dias_antes, hoy).estado);
  return {
    pendientes: estados.filter((estado) => estado === "proximo" || estado === "hoy" || estado === "vencido").length,
    vencidos: estados.filter((estado) => estado === "vencido").length,
  };
}
