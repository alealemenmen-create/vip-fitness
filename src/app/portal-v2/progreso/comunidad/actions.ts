"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUTA = "/portal-v2/progreso/comunidad";

function limpiar(texto: string, maximo: number) {
  return texto.trim().replace(/\s+/g, " ").slice(0, maximo);
}

function faltaMigracion(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /comunidad_publicaciones|comunidad_reacciones|comunidad_comentarios|comunidad_reportes/i.test(error.message ?? "")));
}

async function publicacionVisible(id: string) {
  if (!UUID.test(id)) return false;
  const { data } = await createAdminClient().from("comunidad_publicaciones").select("id").eq("id", id).eq("estado", "publicada").maybeSingle();
  return Boolean(data);
}

export async function crearPublicacionComunidadV2(input: { texto: string; fotoId?: string | null }) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes publicar en modo solo lectura." };
  const texto = limpiar(input.texto, 500);
  const fotoId = input.fotoId && UUID.test(input.fotoId) ? input.fotoId : null;
  if (!texto && !fotoId) return { ok: false, error: "Escribe un mensaje o elige una foto." };
  const db = createAdminClient();
  if (fotoId) {
    const { data: foto } = await db.from("fotos_progreso").select("id").eq("id", fotoId).eq("alumno_id", alumnoId).maybeSingle();
    if (!foto) return { ok: false, error: "Esa foto no pertenece a tu galería privada." };
  }
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("comunidad_publicaciones").select("id", { count: "exact", head: true }).eq("alumno_id", alumnoId).gte("created_at", desde).neq("estado", "eliminada");
  if ((count ?? 0) >= 5) return { ok: false, error: "Alcanzaste el máximo de 5 publicaciones por día." };
  const { error } = await db.from("comunidad_publicaciones").insert({ alumno_id: alumnoId, foto_progreso_id: fotoId, texto });
  if (error) {
    if (faltaMigracion(error)) return { ok: false, error: "La comunidad social todavía no está habilitada en este entorno." };
    return { ok: false, error: "No pudimos publicar. Inténtalo nuevamente." };
  }
  revalidatePath(RUTA);
  return { ok: true, error: null };
}

export async function alternarAplausoComunidadV2(publicacionId: string, activo: boolean) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes reaccionar en modo solo lectura." };
  if (!(await publicacionVisible(publicacionId))) return { ok: false, error: "La publicación ya no está disponible." };
  const db = createAdminClient();
  const resultado = activo
    ? await db.from("comunidad_reacciones").upsert({ publicacion_id: publicacionId, alumno_id: alumnoId }, { onConflict: "publicacion_id,alumno_id" })
    : await db.from("comunidad_reacciones").delete().eq("publicacion_id", publicacionId).eq("alumno_id", alumnoId);
  if (resultado.error) return { ok: false, error: "No pudimos actualizar el aplauso." };
  revalidatePath(RUTA);
  return { ok: true, error: null };
}

export async function comentarComunidadV2(publicacionId: string, contenido: string) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes comentar en modo solo lectura." };
  const texto = limpiar(contenido, 280);
  if (texto.length < 2) return { ok: false, error: "El comentario es demasiado corto." };
  if (!(await publicacionVisible(publicacionId))) return { ok: false, error: "La publicación ya no está disponible." };
  const db = createAdminClient();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("comunidad_comentarios").select("id", { count: "exact", head: true }).eq("alumno_id", alumnoId).gte("created_at", desde).neq("estado", "eliminado");
  if ((count ?? 0) >= 30) return { ok: false, error: "Alcanzaste el límite diario de comentarios." };
  const { error } = await db.from("comunidad_comentarios").insert({ publicacion_id: publicacionId, alumno_id: alumnoId, texto });
  if (error) return { ok: false, error: "No pudimos publicar el comentario." };
  revalidatePath(RUTA);
  return { ok: true, error: null };
}

export async function eliminarContenidoComunidadV2(tipo: "publicacion" | "comentario", id: string) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura || !UUID.test(id)) return { ok: false, error: "No puedes eliminar ese contenido." };
  const db = createAdminClient();
  const resultado = tipo === "publicacion"
    ? await db.from("comunidad_publicaciones").update({ estado: "eliminada", updated_at: new Date().toISOString() }).eq("id", id).eq("alumno_id", alumnoId)
    : await db.from("comunidad_comentarios").update({ estado: "eliminado" }).eq("id", id).eq("alumno_id", alumnoId);
  if (resultado.error) return { ok: false, error: "No pudimos eliminar el contenido." };
  revalidatePath(RUTA);
  return { ok: true, error: null };
}

export async function reportarPublicacionComunidadV2(publicacionId: string, motivoEntrada: string) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes reportar en modo solo lectura." };
  const motivo = limpiar(motivoEntrada, 160);
  if (motivo.length < 3 || !(await publicacionVisible(publicacionId))) return { ok: false, error: "El reporte no es válido." };
  const { error } = await createAdminClient().from("comunidad_reportes").upsert({ publicacion_id: publicacionId, reportado_por: alumnoId, motivo, estado: "pendiente" }, { onConflict: "publicacion_id,reportado_por" });
  if (error) return { ok: false, error: "No pudimos enviar el reporte." };
  return { ok: true, error: null };
}
