"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bufferAImagenBlob, procesarImagen, TAMANO_MAXIMO_FOTO, TIPOS_IMAGEN } from "@/lib/ejercicios/procesarFoto";
import {
  normalizarConfiguracionEstudioVip,
  type ConfiguracionEstudioVip,
  type DocumentoEstudioVip,
} from "@/lib/estudio-vip/configuracion";
import {
  BUCKET_ESTUDIO_VIP,
  RUTA_BORRADOR_ESTUDIO_VIP,
  RUTA_PUBLICADA_ESTUDIO_VIP,
  obtenerDocumentosEstudioVip,
} from "@/lib/estudio-vip/data";

type ResultadoEstudio = {
  ok: boolean;
  mensaje: string;
  documento?: DocumentoEstudioVip;
};

async function subirJson(ruta: string, documento: DocumentoEstudioVip, upsert: boolean) {
  const cuerpo = new Blob([JSON.stringify(documento, null, 2)], { type: "application/json; charset=utf-8" });
  return createAdminClient().storage.from(BUCKET_ESTUDIO_VIP).upload(ruta, cuerpo, {
    contentType: "application/json; charset=utf-8",
    cacheControl: "0",
    upsert,
  });
}

function revalidarEstudio() {
  revalidatePath("/admin/estudio-vip");
  revalidatePath("/portal-v2", "layout");
}

export async function guardarBorradorEstudioVip(configuracion: ConfiguracionEstudioVip): Promise<ResultadoEstudio> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const { borrador, publicado } = await obtenerDocumentosEstudioVip();
  const documento: DocumentoEstudioVip = {
    esquema: 1,
    version: Math.max(borrador.version, publicado.version),
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: sesion.nombre,
    configuracion: normalizarConfiguracionEstudioVip(configuracion),
  };
  const { error } = await subirJson(RUTA_BORRADOR_ESTUDIO_VIP, documento, true);
  if (error) return { ok: false, mensaje: `No se pudo guardar el borrador: ${error.message}` };
  revalidarEstudio();
  return { ok: true, mensaje: "Borrador guardado. Los alumnos todavía ven la versión publicada.", documento };
}

export async function publicarEstudioVip(configuracion: ConfiguracionEstudioVip): Promise<ResultadoEstudio> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const { publicado } = await obtenerDocumentosEstudioVip();
  const ahora = new Date().toISOString();

  // El historial es sólo de anexado: antes de reemplazar una publicación se
  // conserva una instantánea que nunca se elimina desde la interfaz.
  if (publicado.version > 0) {
    const rutaHistorial = `_estudio-vip/historial/v${publicado.version}-${ahora.replace(/[:.]/g, "-")}-${randomUUID()}.json`;
    const respaldo = await subirJson(rutaHistorial, publicado, false);
    if (respaldo.error) return { ok: false, mensaje: `No se publicó porque no pudimos crear el respaldo previo: ${respaldo.error.message}` };
  }

  const documento: DocumentoEstudioVip = {
    esquema: 1,
    version: publicado.version + 1,
    actualizadoEn: ahora,
    actualizadoPor: sesion.nombre,
    configuracion: normalizarConfiguracionEstudioVip(configuracion),
  };
  const publicacion = await subirJson(RUTA_PUBLICADA_ESTUDIO_VIP, documento, true);
  if (publicacion.error) return { ok: false, mensaje: `No se pudo publicar: ${publicacion.error.message}` };

  // El borrador queda sincronizado con lo publicado para que la siguiente
  // edición parta exactamente desde la versión que ve el alumno.
  const borrador = await subirJson(RUTA_BORRADOR_ESTUDIO_VIP, documento, true);
  if (borrador.error) console.error("[estudio-vip] Publicado, pero no se pudo sincronizar el borrador:", borrador.error);
  revalidarEstudio();
  return { ok: true, mensaje: `Versión ${documento.version} publicada en Portal V2.`, documento };
}

export async function subirPortadaEstudioVip(formData: FormData): Promise<{ ok: boolean; mensaje: string; url?: string }> {
  await requireRol(["entrenador", "admin"]);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, mensaje: "Selecciona una fotografía." };
  if (!TIPOS_IMAGEN.has(archivo.type)) return { ok: false, mensaje: "Usa JPG, PNG, WebP, HEIC o HEIF." };
  if (archivo.size > TAMANO_MAXIMO_FOTO) return { ok: false, mensaje: "La fotografía supera el máximo de 15 MB." };

  const procesada = await procesarImagen(Buffer.from(await archivo.arrayBuffer()));
  if ("error" in procesada) return { ok: false, mensaje: procesada.error };
  const ruta = `estudio-vip/portadas/${Date.now()}-${randomUUID()}.webp`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("ejercicios-fotos").upload(ruta, bufferAImagenBlob(procesada.completa), {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, mensaje: `No se pudo subir la portada: ${error.message}` };
  const url = admin.storage.from("ejercicios-fotos").getPublicUrl(ruta).data.publicUrl;
  return { ok: true, mensaje: "Portada optimizada y preparada. Guarda o publica para aplicarla.", url };
}
