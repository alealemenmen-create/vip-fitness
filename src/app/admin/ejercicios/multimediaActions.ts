"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { TAG_BIBLIOTECA_EJERCICIOS } from "@/lib/ejercicios/data";
import {
  bufferAImagenBlob,
  hashearImagen,
  procesarImagen,
  TAMANO_MAXIMO_FOTO as TAMANO_MAXIMO,
  TIPOS_IMAGEN,
} from "@/lib/ejercicios/procesarFoto";
import { consultarVideoCloudflare } from "@/lib/cloudflare/stream";

/**
 * Historial y ángulos extra de multimedia (instructivo de galería
 * multimedia, Fase 3, §8.3). ADITIVA a propósito: las columnas de
 * `ejercicios` (foto_miniatura_url, video_cloudflare_uid...) siguen siendo
 * la única fuente que lee el portal del alumno y el resto de la app — acá
 * solo se guarda de dónde vienen y qué otras versiones existen. Cuando algo
 * de esta tabla pasa a ser portada o video principal, recién ahí se copia a
 * esas columnas de siempre.
 */

function avisarCambios() {
  revalidateTag(TAG_BIBLIOTECA_EJERCICIOS, { expire: 0 });
  revalidatePath("/admin/ejercicios");
  revalidatePath("/alumno/entrenar");
}

export type ItemMultimedia = {
  id: string;
  tipo: "imagen" | "video";
  rol: "portada" | "galeria" | "demostracion" | "error_comun";
  esPrincipal: boolean;
  estado: "procesando" | "listo" | "error" | "archivado";
  urlMiniatura: string | null;
  urlCompleta: string | null;
  videoCloudflareUid: string | null;
  duracionSeg: number | null;
  creadoEn: string;
  archivadoEn: string | null;
};

function aItemMultimedia(fila: {
  id: string;
  tipo: "imagen" | "video";
  rol: "portada" | "galeria" | "demostracion" | "error_comun";
  es_principal: boolean;
  estado: "procesando" | "listo" | "error" | "archivado";
  storage_path_miniatura: string | null;
  storage_path_completa: string | null;
  video_cloudflare_uid: string | null;
  duracion_seg: number | null;
  creado_en: string;
  archivado_en: string | null;
}): ItemMultimedia {
  return {
    id: fila.id,
    tipo: fila.tipo,
    rol: fila.rol,
    esPrincipal: fila.es_principal,
    estado: fila.estado,
    urlMiniatura: fila.storage_path_miniatura,
    urlCompleta: fila.storage_path_completa,
    videoCloudflareUid: fila.video_cloudflare_uid,
    duracionSeg: fila.duracion_seg,
    creadoEn: fila.creado_en,
    archivadoEn: fila.archivado_en,
  };
}

/** Fotos de galería (no principales, no archivadas) + videos archivados de
 * un ejercicio — lo que ve el editor para ofrecer "usar como portada" o
 * "restaurar". Devuelve listas vacías sin reventar si 0101 todavía no corrió. */
export async function obtenerMultimediaDeEjercicio(
  ejercicioId: string
): Promise<{ fotosGaleria: ItemMultimedia[]; videosArchivados: ItemMultimedia[] }> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ejercicio_multimedia")
    .select(
      "id, tipo, rol, es_principal, estado, storage_path_miniatura, storage_path_completa, video_cloudflare_uid, duracion_seg, creado_en, archivado_en"
    )
    .eq("ejercicio_id", ejercicioId)
    .order("creado_en", { ascending: false });
  if (error) return { fotosGaleria: [], videosArchivados: [] };

  const items = (data ?? []).map(aItemMultimedia);
  return {
    fotosGaleria: items.filter((i) => i.tipo === "imagen" && !i.esPrincipal && i.estado === "listo"),
    videosArchivados: items.filter((i) => i.tipo === "video" && i.estado === "archivado"),
  };
}

/**
 * Registra la foto que acaba de quedar como portada de un ejercicio — se
 * llama desde `subirFotoEjercicio` (actions.ts) después de que la portada
 * ya está guardada, nunca antes. Best-effort: si esto falla, la portada real
 * ya se guardó bien, no tiene sentido devolver error por el historial.
 *
 * Demota cualquier fila que todavía figure principal (quedó de una portada
 * previa) para no romper el índice único `ejercicio_multimedia_principal_unique`.
 */
export async function registrarFotoPrincipal(
  ejercicioId: string,
  datos: { urlMiniatura: string; urlCompleta: string; hash: string | null; creadoPor: string }
): Promise<void> {
  const supabase = await createClient();
  const { error: errorDemocion } = await supabase
    .from("ejercicio_multimedia")
    .update({ es_principal: false })
    .eq("ejercicio_id", ejercicioId)
    .eq("tipo", "imagen")
    .eq("es_principal", true);
  if (errorDemocion?.code === "42P01" || errorDemocion?.code === "PGRST205") return; // 0101 no corrió todavía

  await supabase.from("ejercicio_multimedia").insert({
    ejercicio_id: ejercicioId,
    tipo: "imagen",
    rol: "portada",
    es_principal: true,
    estado: "listo",
    storage_path_miniatura: datos.urlMiniatura,
    storage_path_completa: datos.urlCompleta,
    hash_sha256: datos.hash,
    creado_por: datos.creadoPor,
  });
}

export type AgregarFotoGaleriaState = { error: string | null; ok: boolean };

/**
 * Suma una foto MÁS al ejercicio (otro ángulo) sin tocar la portada actual
 * — a diferencia de `subirFotoEjercicio`, que siempre reemplaza. Mismo
 * procesamiento (miniatura + completa, hash, límite de tamaño) que la
 * portada; se duplica ese tramo en vez de forzar a `subirFotoEjercicio` — ya
 * tiene su propia lógica de "reemplazo vs. primera foto" entrelazada, y no
 * vale la pena arriesgar ese camino ya probado para reusarlo acá.
 */
export async function agregarFotoGaleria(
  _prevState: AgregarFotoGaleriaState,
  formData: FormData
): Promise<AgregarFotoGaleriaState> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const ejercicioId = String(formData.get("ejercicio_id") || "");
  const archivo = formData.get("foto") as File | null;
  if (!ejercicioId) return { error: "Falta el ejercicio.", ok: false };
  if (!archivo || archivo.size === 0) return { error: "Elegí una foto.", ok: false };
  if (archivo.size > TAMANO_MAXIMO) return { error: "La foto pesa demasiado (máx. 15 MB).", ok: false };
  if (archivo.type && !TIPOS_IMAGEN.has(archivo.type)) {
    return { error: "Formato no soportado — subí una foto JPG, PNG o HEIC.", ok: false };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const procesada = await procesarImagen(bytes);
  if ("error" in procesada) return { error: procesada.error, ok: false };
  const hash = hashearImagen(procesada.miniatura);

  const sello = Date.now();
  const rutaMini = `${ejercicioId}/galeria-${sello}-mini.webp`;
  const rutaCompleta = `${ejercicioId}/galeria-${sello}-completa.webp`;
  const [subeMini, subeCompleta] = await Promise.all([
    supabase.storage.from("ejercicios-fotos").upload(rutaMini, bufferAImagenBlob(procesada.miniatura), { contentType: "image/webp" }),
    supabase.storage.from("ejercicios-fotos").upload(rutaCompleta, bufferAImagenBlob(procesada.completa), { contentType: "image/webp" }),
  ]);
  if (subeMini.error || subeCompleta.error) {
    return { error: "No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.", ok: false };
  }
  const urlMini = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaMini).data.publicUrl;
  const urlCompleta = supabase.storage.from("ejercicios-fotos").getPublicUrl(rutaCompleta).data.publicUrl;

  const { error } = await supabase.from("ejercicio_multimedia").insert({
    ejercicio_id: ejercicioId,
    tipo: "imagen",
    rol: "galeria",
    es_principal: false,
    estado: "listo",
    storage_path_miniatura: urlMini,
    storage_path_completa: urlCompleta,
    hash_sha256: hash,
    creado_por: entrenador.userId,
  });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { error: "Esta base todavía no tiene la actualización para varias fotos por ejercicio.", ok: false };
    }
    return { error: "La foto se subió pero no se pudo agregar a la galería.", ok: false };
  }

  avisarCambios();
  return { error: null, ok: true };
}

export type ElegirPrincipalState = { error: string | null; ok: boolean };

/**
 * Promueve una foto de la galería a portada — copia sus URLs a las columnas
 * de `ejercicios` de siempre (lo que de verdad ve el alumno) y baja la
 * portada actual a la galería en su lugar. Ninguna foto se pierde: es un
 * intercambio, no un reemplazo.
 */
export async function elegirFotoPrincipal(multimediaId: string): Promise<ElegirPrincipalState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: elegida } = await supabase
    .from("ejercicio_multimedia")
    .select("id, ejercicio_id, storage_path_miniatura, storage_path_completa")
    .eq("id", multimediaId)
    .eq("tipo", "imagen")
    .maybeSingle();
  if (!elegida || !elegida.storage_path_miniatura || !elegida.storage_path_completa) {
    return { error: "No se encontró esa foto.", ok: false };
  }

  const { data: actual } = await supabase
    .from("ejercicios")
    .select("foto_miniatura_url, foto_completa_url")
    .eq("id", elegida.ejercicio_id)
    .maybeSingle();

  // La portada actual pasa a la galería — mismas URLs, ningún archivo se
  // vuelve a subir. Encuadre nuevo en 50/50 a propósito: es una foto
  // distinta, el encuadre viejo no tiene por qué servirle.
  const { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({
      foto_miniatura_url: elegida.storage_path_miniatura,
      foto_completa_url: elegida.storage_path_completa,
      foto_panorama_x: 50,
      foto_panorama_y: 50,
      foto_cuadrada_x: 50,
      foto_cuadrada_y: 50,
    })
    .eq("id", elegida.ejercicio_id);
  if (errorUpdate) return { error: "No se pudo cambiar la portada.", ok: false };

  await supabase.from("ejercicio_multimedia").update({ es_principal: true }).eq("id", multimediaId);
  if (actual?.foto_miniatura_url && actual.foto_completa_url) {
    // La que dejó de ser portada entra a la galería como una foto más — si
    // ya estaba registrada (vino de `registrarFotoPrincipal`), esto no
    // hace falta; si no, se registra ahora para no perderla.
    await supabase
      .from("ejercicio_multimedia")
      .update({ es_principal: false })
      .eq("ejercicio_id", elegida.ejercicio_id)
      .eq("tipo", "imagen")
      .neq("id", multimediaId)
      .eq("es_principal", true);
  }

  avisarCambios();
  return { error: null, ok: true };
}

export async function quitarFotoGaleria(multimediaId: string): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  await supabase.from("ejercicio_multimedia").delete().eq("id", multimediaId).eq("es_principal", false);
  avisarCambios();
}

/**
 * Archiva (no borra) el video que un reemplazo acaba de dejar de ser
 * principal — se llama desde `sincronizarVideoCloudflare` (actions.ts)
 * cuando el nuevo clip queda confirmado 'listo'. Antes de Fase 3 ese video
 * se borraba de Cloudflare acá mismo; ahora queda archivado y restaurable
 * (instructivo §11.4/§18, "limpieza con período de gracia" — el borrado
 * físico real queda para un proceso aparte, todavía no construido).
 */
export async function archivarVideoReemplazado(
  ejercicioId: string,
  uidReemplazado: string,
  datos: { duracionSeg: number | null; creadoPor: string }
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ejercicio_multimedia").insert({
    ejercicio_id: ejercicioId,
    tipo: "video",
    rol: "portada",
    es_principal: false,
    estado: "archivado",
    video_cloudflare_uid: uidReemplazado,
    duracion_seg: datos.duracionSeg,
    creado_por: datos.creadoPor,
    archivado_en: new Date().toISOString(),
  });
}

export type RestaurarVideoState = { error: string | null; ok: boolean };

/**
 * Vuelve a poner como video activo uno que había quedado archivado — el
 * archivo sigue en Cloudflare (nunca se borró) así que no hace falta volver
 * a subir nada. El que estaba activo pasa a archivado en su lugar: es un
 * intercambio, igual que `elegirFotoPrincipal`.
 */
export async function restaurarVideoArchivado(multimediaId: string): Promise<RestaurarVideoState> {
  const entrenador = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: archivado } = await supabase
    .from("ejercicio_multimedia")
    .select("id, ejercicio_id, video_cloudflare_uid, duracion_seg")
    .eq("id", multimediaId)
    .eq("tipo", "video")
    .eq("estado", "archivado")
    .maybeSingle();
  if (!archivado || !archivado.video_cloudflare_uid) return { error: "No se encontró ese video.", ok: false };

  // El archivo pudo seguir procesando cambios en Cloudflare mientras estuvo
  // archivado (poco probable, pero gratis de chequear) — se confirma su
  // estado real en vez de asumir que sigue "listo".
  const estadoReal = await consultarVideoCloudflare(archivado.video_cloudflare_uid);
  if (!estadoReal || estadoReal.estado === "error") {
    return { error: "Ese video ya no está disponible en Cloudflare.", ok: false };
  }

  const { data: activoActual } = await supabase
    .from("ejercicios")
    .select("video_cloudflare_uid")
    .eq("id", archivado.ejercicio_id)
    .maybeSingle();

  const { error: errorUpdate } = await supabase
    .from("ejercicios")
    .update({
      video_cloudflare_uid: archivado.video_cloudflare_uid,
      video_cloudflare_estado: estadoReal.estado,
      video_cloudflare_duracion_seg: estadoReal.duracion,
      video_cloudflare_miniatura_url: estadoReal.miniaturaUrl,
      video_cloudflare_error: null,
      video_cloudflare_uid_anterior: null,
      video_cloudflare_ancho: estadoReal.ancho,
      video_cloudflare_alto: estadoReal.alto,
    })
    .eq("id", archivado.ejercicio_id);
  if (errorUpdate) return { error: "No se pudo restaurar el video.", ok: false };

  // El restaurado deja de estar archivado (ahora es el activo, representado
  // por las columnas de `ejercicios` — no hace falta que siga en esta
  // tabla). El que acababa de ser activo pasa a archivado en su lugar.
  await supabase.from("ejercicio_multimedia").delete().eq("id", multimediaId);
  if (activoActual?.video_cloudflare_uid && activoActual.video_cloudflare_uid !== archivado.video_cloudflare_uid) {
    await archivarVideoReemplazado(archivado.ejercicio_id, activoActual.video_cloudflare_uid, {
      duracionSeg: null,
      creadoPor: entrenador.userId,
    });
  }

  avisarCambios();
  return { error: null, ok: true };
}

export type CambioMultimediaReciente = {
  id: string;
  ejercicioId: string;
  ejercicioNombre: string;
  tipo: "imagen" | "video";
  archivadoEn: string;
};

/**
 * Portadas y videos reemplazados en los últimos 7 días (instructivo §15,
 * "portada reemplazada recientemente") — pestaña Calidad, Fase 4. Sirve para
 * notar un reemplazo por error antes de que pase desapercibido: cada fila
 * es restaurable desde "Otras fotos"/"Clips anteriores" en la ficha del
 * ejercicio (Fase 3).
 */
export async function obtenerCambiosRecientesMultimedia(): Promise<CambioMultimediaReciente[]> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ejercicio_multimedia")
    .select("id, ejercicio_id, tipo, archivado_en")
    .eq("estado", "archivado")
    .gte("archivado_en", desde)
    .order("archivado_en", { ascending: false })
    .limit(30);
  if (error) return [];
  const filas = (data ?? []).filter(
    (fila): fila is typeof fila & { archivado_en: string } => fila.archivado_en !== null
  );
  if (filas.length === 0) return [];

  // Sin relación declarada en el tipo Database (mismo criterio que el resto
  // de las tablas de este proyecto: sin embeds, una segunda consulta manual).
  const idsEjercicios = [...new Set(filas.map((f) => f.ejercicio_id))];
  const { data: ejercicios } = await supabase.from("ejercicios").select("id, nombre").in("id", idsEjercicios);
  const nombresPorId = new Map((ejercicios ?? []).map((e) => [e.id, e.nombre]));

  return filas
    .filter((fila) => nombresPorId.has(fila.ejercicio_id))
    .map((fila) => ({
      id: fila.id,
      ejercicioId: fila.ejercicio_id,
      ejercicioNombre: nombresPorId.get(fila.ejercicio_id)!,
      tipo: fila.tipo,
      archivadoEn: fila.archivado_en,
    }));
}
