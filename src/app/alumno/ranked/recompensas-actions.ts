"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mensajeCanje(mensaje: string) {
  if (mensaje.includes("SALDO_INSUFICIENTE")) return "No tienes Puntos VIP suficientes para este canje.";
  if (mensaje.includes("SIN_STOCK")) return "La recompensa acaba de quedar sin stock.";
  if (mensaje.includes("RECOMPENSA_NO_DISPONIBLE")) return "La recompensa ya no está disponible.";
  if (/solicitar_canje_vip|PGRST202|42883/i.test(mensaje)) return "Los canjes todavía no están habilitados en este entorno.";
  return "No pudimos completar el canje. Tus puntos no fueron descontados.";
}

export async function solicitarCanjeVip(recompensaId: string) {
  const { soloLectura } = await requireAlumno();
  if (soloLectura || !UUID.test(recompensaId)) return { ok: false, error: "El canje no es válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("solicitar_canje_vip", { p_recompensa_id: recompensaId });
  if (error || !data) return { ok: false, error: mensajeCanje(error?.message ?? "") };
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/ranked");
  revalidatePath("/portal-v2/progreso/comunidad");
  revalidatePath("/portal-v2/progreso/ranking");
  return { ok: true, error: null };
}
