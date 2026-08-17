"use server";

import { requireRol } from "@/lib/auth";
import { consultarVideoCloudflare, urlEmbedFirmada } from "@/lib/cloudflare/stream";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (!url) return { ok: false, error: "No se pudo abrir el video." };

  let ancho = data.video_cloudflare_ancho;
  let alto = data.video_cloudflare_alto;
  // Videos subidos antes de que existieran estas columnas se quedan sin
  // ancho/alto para siempre si no se completan acá: nada más vuelve a
  // consultar un video que ya está "listo" (ver EditorVideoCloudflare, que
  // solo sincroniza mientras está "procesando"). Se completa una sola vez,
  // la primera vez que alguien lo mira, y no de nuevo — el alumno no
  // necesita permiso de escritura sobre `ejercicios`, por eso admin client.
  if (ancho == null || alto == null) {
    const estado = await consultarVideoCloudflare(data.video_cloudflare_uid);
    if (estado?.ancho && estado.alto) {
      ancho = estado.ancho;
      alto = estado.alto;
      await createAdminClient()
        .from("ejercicios")
        .update({ video_cloudflare_ancho: ancho, video_cloudflare_alto: alto })
        .eq("id", ejercicioId)
        .eq("video_cloudflare_uid", data.video_cloudflare_uid);
    }
  }

  return { ok: true, url, ancho, alto };
}
