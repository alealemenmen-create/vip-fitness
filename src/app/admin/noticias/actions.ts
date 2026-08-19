"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

export async function crearAnuncio(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireAdmin();

  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  const importante = formData.get("importante") === "on";
  const borradorId = String(formData.get("borrador_id") || "").trim();
  if (!titulo) return { error: "Ingresa un título.", ok: false };
  if (!mensaje) return { error: "Ingresa el mensaje del anuncio.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("anuncios")
    .insert({ titulo, mensaje, importante, creado_por: sesion.userId });
  if (error) return { error: "No fue posible publicar el anuncio.", ok: false };

  if (borradorId) {
    await supabase
      .from("borradores_noticias")
      .update({ estado: "publicado", publicado_en: new Date().toISOString() })
      .eq("id", borradorId)
      .eq("estado", "pendiente");
  }

  revalidatePath("/admin/noticias");
  revalidatePath("/alumno/noticias");
  return okState;
}

export async function descartarBorrador(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("borradores_noticias").update({ estado: "descartado" }).eq("id", id);
  revalidatePath("/admin/noticias");
}

export async function eliminarAnuncio(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("anuncios").delete().eq("id", id);

  revalidatePath("/admin/noticias");
  revalidatePath("/alumno/noticias");
}
