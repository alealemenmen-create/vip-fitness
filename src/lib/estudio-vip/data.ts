import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONFIGURACION_ESTUDIO_VIP_INICIAL,
  normalizarConfiguracionEstudioVip,
  type DocumentoEstudioVip,
} from "./configuracion";

export const BUCKET_ESTUDIO_VIP = "documentos";
export const RUTA_BORRADOR_ESTUDIO_VIP = "_estudio-vip/borrador.json";
export const RUTA_PUBLICADA_ESTUDIO_VIP = "_estudio-vip/publicada.json";

async function leerDocumento(ruta: string): Promise<DocumentoEstudioVip | null> {
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET_ESTUDIO_VIP).download(ruta);
    if (error || !data) return null;
    const candidata = JSON.parse(await data.text()) as Partial<DocumentoEstudioVip>;
    return {
      esquema: 1,
      version: Number.isInteger(candidata.version) && Number(candidata.version) >= 0 ? Number(candidata.version) : 0,
      actualizadoEn: typeof candidata.actualizadoEn === "string" ? candidata.actualizadoEn : "",
      actualizadoPor: typeof candidata.actualizadoPor === "string" ? candidata.actualizadoPor : "",
      configuracion: normalizarConfiguracionEstudioVip(candidata.configuracion),
    };
  } catch (error) {
    console.error(`[estudio-vip] No se pudo leer ${ruta}:`, error);
    return null;
  }
}

export const obtenerDocumentoPublicadoEstudioVip = cache(async () => {
  return await leerDocumento(RUTA_PUBLICADA_ESTUDIO_VIP) ?? {
    esquema: 1 as const,
    version: 0,
    actualizadoEn: "",
    actualizadoPor: "sistema",
    configuracion: CONFIGURACION_ESTUDIO_VIP_INICIAL,
  };
});

export const obtenerDocumentosEstudioVip = cache(async () => {
  const [publicado, borrador] = await Promise.all([
    obtenerDocumentoPublicadoEstudioVip(),
    leerDocumento(RUTA_BORRADOR_ESTUDIO_VIP),
  ]);
  return { publicado, borrador: borrador ?? publicado };
});
