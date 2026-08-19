"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";

export async function guardarRecompensaVip(input: { nombre: string; descripcion: string; tipo: "digital" | "servicio" | "fisica"; costo: number; stock: number | null }) {
  await requireAdmin();
  const nombre = input.nombre.trim().replace(/\s+/g, " ").slice(0, 80);
  const descripcion = input.descripcion.trim().slice(0, 500);
  const costo = Math.round(input.costo);
  const stock = input.stock === null ? null : Math.round(input.stock);
  if (nombre.length < 2 || !Number.isInteger(costo) || costo < 1 || costo > 1_000_000 || (stock !== null && (stock < 0 || stock > 100_000))) return { ok: false, error: "Revisa nombre, costo y stock." };
  const { error } = await createAdminClient().from("recompensas_vip_catalogo").insert({ nombre, descripcion, tipo: input.tipo, costo_puntos: costo, stock });
  if (error) return { ok: false, error: /recompensas_vip_/i.test(error.message) ? "Primero activa la migración 0107." : "No pudimos crear la recompensa." };
  revalidatePath("/admin/puntos");
  revalidatePath("/alumno/ranked");
  return { ok: true, error: null };
}

export async function cambiarEstadoRecompensaVip(id: string, activa: boolean) {
  await requireAdmin();
  const { error } = await createAdminClient().from("recompensas_vip_catalogo").update({ activo: activa, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No pudimos actualizar la recompensa." };
  revalidatePath("/admin/puntos");
  revalidatePath("/alumno/ranked");
  return { ok: true, error: null };
}

export async function ajustarStockRecompensaVip(id: string, delta: number, sinLimite = false) {
  await requireAdmin();
  if (!Number.isInteger(delta) || Math.abs(delta) > 100_000) return { ok: false, error: "El ajuste de stock no es válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_stock_recompensa_vip", { p_recompensa_id: id, p_delta: delta, p_sin_limite: sinLimite });
  if (error) return { ok: false, error: "No pudimos ajustar el stock." };
  revalidatePath("/admin/puntos");
  revalidatePath("/alumno/ranked");
  return { ok: true, error: null };
}

export async function resolverCanjeVip(id: string, estado: "aprobado" | "entregado" | "rechazado", nota: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolver_canje_vip", { p_canje_id: id, p_estado: estado, p_nota: nota.trim().slice(0, 500) || null });
  if (error) return { ok: false, error: "No pudimos resolver el canje. Verifica su estado actual." };
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/puntos");
  revalidatePath("/alumno/ranked");
  return { ok: true, error: null };
}
