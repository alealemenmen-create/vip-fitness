"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

export async function crearAnuncio(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);

  const titulo = String(formData.get("titulo") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  const importante = formData.get("importante") === "on";
  if (!titulo) return { error: "Ingresa un título.", ok: false };
  if (!mensaje) return { error: "Ingresa el mensaje del anuncio.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("anuncios")
    .insert({ titulo, mensaje, importante, creado_por: sesion.userId });
  if (error) return { error: "No fue posible publicar el anuncio.", ok: false };

  revalidatePath("/admin/noticias");
  revalidatePath("/alumno/noticias");
  return okState;
}

export async function eliminarAnuncio(formData: FormData): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const id = String(formData.get("id") || "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("anuncios").delete().eq("id", id);

  revalidatePath("/admin/noticias");
  revalidatePath("/alumno/noticias");
}
