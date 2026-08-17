"use server";

import { requireRol } from "@/lib/auth";
import { urlEmbedFirmada } from "@/lib/cloudflare/stream";
import { createClient } from "@/lib/supabase/server";

export type ObtenerVideoResultado =
  | { ok: true; url: string; ancho: number | null; alto: number | null }
  | { ok: false; error: string };

/** Emite el enlace privado solamente para usuarios autenticados y bajo demanda. */
export async function obtenerVideoCloudflareEjercicio(ejercicioId: string): Promise<ObtenerVideoResultado> {
  await requireRol(["alumno", "entrenador", "admin"]);
  if (!ejercicioId) return { ok: false, error: "Falta el ejercicio." };
  const { data } = await (await createClient())
    .from("ejercicios")
    .select("video_cloudflare_uid, video_cloudflare_estado, video_cloudflare_ancho, video_cloudflare_alto")
    .eq("id", ejercicioId)
    .maybeSingle();
  if (!data?.video_cloudflare_uid || data.video_cloudflare_estado !== "listo") {
    return { ok: false, error: "El video todavía no está listo." };
  }
  const url = await urlEmbedFirmada(data.video_cloudflare_uid);
  return url
    ? { ok: true, url, ancho: data.video_cloudflare_ancho, alto: data.video_cloudflare_alto }
    : { ok: false, error: "No se pudo abrir el video." };
}
