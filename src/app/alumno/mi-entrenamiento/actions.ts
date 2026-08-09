"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EstadoPerfilEntrenamiento = { error: string | null; ok: boolean };

const texto = (fd: FormData, nombre: string) => String(fd.get(nombre) || "").trim() || null;

export async function guardarPerfilEntrenamiento(
  _estado: EstadoPerfilEntrenamiento,
  formData: FormData
): Promise<EstadoPerfilEntrenamiento> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "Este perfil está en modo solo lectura.", ok: false };

  const objetivo = texto(formData, "objetivo_principal");
  const dias = Number(formData.get("dias_disponibles"));
  const minutos = Number(formData.get("minutos_sesion"));
  if (!objetivo) return { error: "Elige tu objetivo principal.", ok: false };
  if (!Number.isInteger(dias) || dias < 1 || dias > 7) return { error: "Indica entre 1 y 7 días.", ok: false };
  if (!Number.isInteger(minutos) || minutos < 20 || minutos > 180) return { error: "Indica una duración entre 20 y 180 minutos.", ok: false };
  if (formData.get("declaracion_veracidad") !== "si") return { error: "Debes confirmar que la información es correcta.", ok: false };

  const molestias = texto(formData, "molestias");
  const lesiones = texto(formData, "lesiones_diagnosticadas");
  const condiciones = texto(formData, "condiciones_medicas");
  const medicamentos = texto(formData, "medicamentos_relevantes");
  const requiereRevision = Boolean(molestias || lesiones || condiciones || medicamentos);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const payload = {
    alumno_id: alumnoId,
    objetivo_principal: objetivo,
    objetivo_secundario: texto(formData, "objetivo_secundario"),
    dias_disponibles: dias,
    minutos_sesion: minutos,
    experiencia: texto(formData, "experiencia"),
    cardio_nivel: texto(formData, "cardio_nivel"),
    preferencia_equipo: texto(formData, "preferencia_equipo"),
    actividades_adicionales: texto(formData, "actividades_adicionales"),
    ejercicios_preferidos: texto(formData, "ejercicios_preferidos"),
    ejercicios_no_deseados: texto(formData, "ejercicios_no_deseados"),
    molestias,
    lesiones_diagnosticadas: lesiones,
    operaciones_previas: texto(formData, "operaciones_previas"),
    condiciones_medicas: condiciones,
    medicamentos_relevantes: medicamentos,
    autorizacion_medica: formData.get("autorizacion_medica") === "si",
    declaracion_veracidad: true,
    requiere_revision: requiereRevision,
    revisado_por: null,
    revisado_en: null,
    completado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("perfiles_entrenamiento").upsert(payload, { onConflict: "alumno_id" });
  if (error) {
    console.error("[mi-entrenamiento] guardar:", error);
    return { error: "No fue posible guardar. Verifica que la migración 0051 esté aplicada.", ok: false };
  }

  // Se conserva el objetivo resumido usado por las funciones existentes.
  await supabase.from("alumno_perfil").update({ objetivo: objetivo.replaceAll("_", " ") }).eq("user_id", alumnoId);
  revalidatePath("/alumno/mi-entrenamiento");
  revalidatePath("/admin/generador");
  return { error: null, ok: true };
}
