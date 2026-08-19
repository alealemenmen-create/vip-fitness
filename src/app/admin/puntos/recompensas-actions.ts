"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";
import { esEstadoAdministrableCanjeVip, esUuidVip, mensajeAdministracionRecompensasVip, textoSeguroVip, validarNuevaRecompensaVip } from "@/lib/recompensas/administracion";

function revalidarRecompensas() {
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/puntos");
  revalidatePath("/alumno/ranked");
  revalidatePath("/portal-v2/progreso/ranking");
}

export async function guardarRecompensaVip(input: unknown) {
  await requireAdmin();
  const validada = validarNuevaRecompensaVip(input);
  if (!validada) return { ok: false, error: "Revisa nombre, tipo, costo y stock." };
  const { nombre, descripcion, tipo, costo, stock } = validada;
  const { error } = await createAdminClient().from("recompensas_vip_catalogo").insert({ nombre, descripcion, tipo, costo_puntos: costo, stock }).select("id").single();
  if (error) return { ok: false, error: mensajeAdministracionRecompensasVip(error.message) };
  revalidarRecompensas();
  return { ok: true, error: null };
}

export async function cambiarEstadoRecompensaVip(id: string, activa: boolean) {
  await requireAdmin();
  if (!esUuidVip(id) || typeof activa !== "boolean") return { ok: false, error: "La recompensa no es válida." };
  const { data, error } = await createAdminClient().from("recompensas_vip_catalogo").update({ activo: activa, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: mensajeAdministracionRecompensasVip(error?.message ?? "RECOMPENSA_NO_EXISTE") };
  revalidarRecompensas();
  return { ok: true, error: null };
}

export async function ajustarStockRecompensaVip(id: string, delta: number, sinLimite = false) {
  await requireAdmin();
  if (!esUuidVip(id) || !Number.isInteger(delta) || Math.abs(delta) > 100_000 || typeof sinLimite !== "boolean") return { ok: false, error: "El ajuste de stock no es válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_stock_recompensa_vip", { p_recompensa_id: id, p_delta: delta, p_sin_limite: sinLimite });
  if (error) return { ok: false, error: mensajeAdministracionRecompensasVip(error.message) };
  revalidarRecompensas();
  return { ok: true, error: null };
}

export async function resolverCanjeVip(id: string, estado: "aprobado" | "entregado" | "rechazado", nota: string) {
  await requireAdmin();
  if (!esUuidVip(id) || !esEstadoAdministrableCanjeVip(estado)) return { ok: false, error: "El canje o su nuevo estado no son válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolver_canje_vip", { p_canje_id: id, p_estado: estado, p_nota: textoSeguroVip(nota, 500) || null });
  if (error) {
    revalidarRecompensas();
    return { ok: false, error: mensajeAdministracionRecompensasVip(error.message) };
  }
  revalidarRecompensas();
  return { ok: true, error: null };
}
