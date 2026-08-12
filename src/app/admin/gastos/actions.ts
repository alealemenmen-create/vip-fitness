"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siguienteFechaPago, type CicloGasto } from "@/lib/gastos/calendario";

export type EstadoGastoAccion = { ok: boolean; mensaje: string };

const opcional = z.string().trim().max(500).transform((valor) => valor || null);
const esquemaGasto = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(2).max(100),
  categoria: z.enum(["infraestructura", "ia", "dominio", "comunicaciones", "desarrollo", "servicio", "otro"]),
  uso_app: opcional,
  proveedor: opcional,
  plan: opcional,
  monto_estimado: z.union([z.literal(""), z.coerce.number().min(0).max(999_999_999)]).transform((valor) => valor === "" ? null : valor),
  moneda: z.enum(["CLP", "USD", "EUR"]),
  ciclo: z.enum(["mensual", "anual", "variable", "unico"]),
  proxima_fecha: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((valor) => valor || null),
  avisar_dias_antes: z.coerce.number().int().min(0).max(90),
  enlace_panel: z.union([z.literal(""), z.string().url().max(500)]).transform((valor) => valor || null),
  notas: opcional,
});

function dbSinTipos(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export async function guardarGasto(
  _prev: EstadoGastoAccion,
  formData: FormData,
): Promise<EstadoGastoAccion> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const entrada = esquemaGasto.safeParse(Object.fromEntries(formData));
  if (!entrada.success) return { ok: false, mensaje: "Revisa el nombre, monto, fecha y días de aviso." };
  const { id, ...valores } = entrada.data;
  const db = dbSinTipos();
  const consulta = id
    ? db.from("gastos_app").update({ ...valores, actualizado_en: new Date().toISOString() }).eq("id", id)
    : db.from("gastos_app").insert({ ...valores, creado_por: sesion.userId });
  const { error } = await consulta;
  if (error) {
    console.error("[gastos] guardar falló:", error.message);
    return { ok: false, mensaje: error.code === "PGRST205" ? "Primero hay que correr la migración 0070." : "No se pudo guardar el servicio." };
  }
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: id ? "Gasto actualizado." : "Servicio agregado." };
}

const esquemaPago = z.object({
  gasto_id: z.string().uuid(),
  fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto_real: z.union([z.literal(""), z.coerce.number().min(0).max(999_999_999)]).transform((valor) => valor === "" ? null : valor),
  nota: opcional,
});

export async function marcarGastoPagado(
  _prev: EstadoGastoAccion,
  formData: FormData,
): Promise<EstadoGastoAccion> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const entrada = esquemaPago.safeParse(Object.fromEntries(formData));
  if (!entrada.success) return { ok: false, mensaje: "Revisa la fecha y el monto pagado." };
  const db = dbSinTipos();
  const { data: gasto, error: errorLectura } = await db
    .from("gastos_app")
    .select("id,ciclo,proxima_fecha,moneda")
    .eq("id", entrada.data.gasto_id)
    .maybeSingle();
  if (errorLectura || !gasto) return { ok: false, mensaje: "No se encontró el gasto." };

  const proxima = siguienteFechaPago(
    gasto.proxima_fecha as string | null,
    gasto.ciclo as CicloGasto,
    entrada.data.fecha_pago,
  );
  const { data: pago, error: errorPago } = await db.from("gastos_app_pagos").insert({
    gasto_id: entrada.data.gasto_id,
    fecha_pago: entrada.data.fecha_pago,
    monto_real: entrada.data.monto_real,
    moneda: gasto.moneda,
    periodo_vencimiento: gasto.proxima_fecha,
    nota: entrada.data.nota,
    registrado_por: sesion.userId,
  }).select("id").single();
  if (errorPago) return { ok: false, mensaje: errorPago.code === "PGRST205" ? "Primero hay que correr la migración 0070." : "No se pudo registrar el pago." };

  const { error: errorActualizar } = await db.from("gastos_app").update({
    proxima_fecha: proxima,
    activo: gasto.ciclo === "unico" ? false : true,
    actualizado_en: new Date().toISOString(),
  }).eq("id", entrada.data.gasto_id);
  if (errorActualizar) {
    await db.from("gastos_app_pagos").delete().eq("id", pago.id);
    return { ok: false, mensaje: "No se pudo mover el próximo vencimiento; el pago no fue guardado." };
  }
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: proxima ? `Pago registrado. Próximo cobro: ${proxima}.` : "Pago registrado en el historial." };
}

export async function cambiarEstadoGasto(formData: FormData): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const activo = formData.get("activo") === "true";
  if (!id.success) return;
  const { error } = await dbSinTipos().from("gastos_app").update({ activo, actualizado_en: new Date().toISOString() }).eq("id", id.data);
  if (error) console.error("[gastos] cambiar estado falló:", error.message);
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
}
