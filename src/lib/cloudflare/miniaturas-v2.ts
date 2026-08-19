import "server-only";

import { urlMiniaturaFirmada } from "./stream";

type ConMiniaturaCloudflare = {
  videoCloudflareUid: string | null;
  videoCloudflareEstado: "subiendo" | "procesando" | "listo" | "error" | null;
  videoCloudflareMiniaturaUrl: string | null;
};

/**
 * Reemplaza en datos V2 la miniatura pública devuelta por el webhook por una
 * URL temporal autorizada. Si la firma falla, se quita la URL privada rota y
 * cada pantalla cae a la foto propia o al arte muscular que ya posee.
 */
export async function firmarMiniaturasCloudflareV2<T extends ConMiniaturaCloudflare>(
  elementos: T[]
): Promise<T[]> {
  const uids = [...new Set(elementos
    .filter((item) => item.videoCloudflareUid && item.videoCloudflareEstado === "listo")
    .map((item) => item.videoCloudflareUid as string))];
  const firmadas = new Map(await Promise.all(uids.map(async (uid) => [uid, await urlMiniaturaFirmada(uid)] as const)));

  return elementos.map((item) => {
    if (!item.videoCloudflareUid || item.videoCloudflareEstado !== "listo") return item;
    return {
      ...item,
      videoCloudflareMiniaturaUrl: firmadas.get(item.videoCloudflareUid) ?? null,
    };
  });
}
