"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  guardarBorradorEstudioVip,
  publicarEstudioVip,
  subirPortadaEstudioVip,
} from "@/app/admin/estudio-vip/actions";
import { BUCKET_ESTUDIO_VIP } from "@/lib/estudio-vip/data";
import { normalizarConfiguracionEstudioVip, type DocumentoEstudioVip } from "@/lib/estudio-vip/configuracion";

const RUTA_HISTORIAL_ESTUDIO_VIP = "_estudio-vip/historial";

function revalidarEstudioV2() {
  revalidatePath("/control-vip/estudio-vip");
  revalidatePath("/portal-v2", "layout");
}

/**
 * Envoltorios finos sobre las acciones reales de Estudio VIP
 * (`src/app/admin/estudio-vip/actions.ts`) — el motor de guardado/publicado
 * es uno solo, compartido con el editor clásico; acá solo se agrega la
 * revalidación de la ruta nueva. No se toca ni una línea del archivo
 * original: `/admin/estudio-vip` sigue exactamente igual.
 */
export async function guardarBorradorEstudioVipV2(configuracion: Parameters<typeof guardarBorradorEstudioVip>[0]) {
  const resultado = await guardarBorradorEstudioVip(configuracion);
  revalidarEstudioV2();
  return resultado;
}

export async function publicarEstudioVipV2(configuracion: Parameters<typeof publicarEstudioVip>[0]) {
  const resultado = await publicarEstudioVip(configuracion);
  revalidarEstudioV2();
  return resultado;
}

export async function subirPortadaEstudioVipV2(formData: FormData) {
  return subirPortadaEstudioVip(formData);
}

export type VersionHistorialEstudioVip = {
  ruta: string;
  version: number;
  fecha: string;
};

/**
 * `publicarEstudioVip` ya escribe un snapshot inmutable en
 * `_estudio-vip/historial/` antes de cada publicación (append-only, nunca se
 * borra desde la interfaz). Hasta ahora nada lo leía — esto es lo que le
 * faltaba a la Fase 0 ("no ofrece historial visible, comparación ni
 * restauración de versiones").
 */
export async function listarHistorialEstudioVip(): Promise<VersionHistorialEstudioVip[]> {
  await requireRol(["entrenador", "admin"]);
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_ESTUDIO_VIP)
    .list(RUTA_HISTORIAL_ESTUDIO_VIP, { limit: 100, sortBy: { column: "name", order: "desc" } });
  if (error || !data) return [];

  return data
    .map((archivo) => {
      // Nombre: v{version}-{timestamp-con-guiones}-{uuid}.json
      const coincidencia = archivo.name.match(/^v(\d+)-/);
      const version = coincidencia ? Number(coincidencia[1]) : 0;
      return {
        ruta: `${RUTA_HISTORIAL_ESTUDIO_VIP}/${archivo.name}`,
        version,
        fecha: archivo.created_at ?? "",
      };
    })
    .sort((a, b) => b.version - a.version);
}

/**
 * Restaura una versión histórica publicándola de nuevo — no reescribe ni
 * borra nada: crea una versión NUEVA con esa configuración, y esa
 * publicación a su vez deja su propio snapshot de lo que reemplazó. El
 * historial nunca se acorta, solo crece hacia adelante.
 */
export async function restaurarVersionEstudioVip(ruta: string): Promise<{ ok: boolean; mensaje: string; documento?: DocumentoEstudioVip }> {
  await requireRol(["entrenador", "admin"]);
  if (!ruta.startsWith(`${RUTA_HISTORIAL_ESTUDIO_VIP}/`)) {
    return { ok: false, mensaje: "Ruta de historial inválida." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET_ESTUDIO_VIP).download(ruta);
  if (error || !data) return { ok: false, mensaje: "No se pudo leer esa versión del historial." };

  try {
    const candidata = JSON.parse(await data.text()) as Partial<DocumentoEstudioVip>;
    const configuracion = normalizarConfiguracionEstudioVip(candidata.configuracion);
    const resultado = await publicarEstudioVip(configuracion);
    revalidarEstudioV2();
    return resultado;
  } catch {
    return { ok: false, mensaje: "Esa versión del historial está dañada o incompleta." };
  }
}

