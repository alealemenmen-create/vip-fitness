"use server";

import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { generarRutinaPorReglas } from "@/lib/generador-rutinas/motor";
import type { BriefGenerador, EjercicioGenerador, PerfilEntrenamiento } from "@/lib/generador-rutinas/tipos";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoGeneracion = { ok: true; borradorId: string | null; rutina: RutinaExtraida; alertas: string[]; reglas: string[] } | { ok: false; error: string };

export async function generarBorradorRutina(brief: BriefGenerador): Promise<ResultadoGeneracion> {
  const sesion = await requireRol(["entrenador", "admin"]);
  if (!brief.alumnoId || brief.dias < 1 || brief.dias > 7 || brief.ejerciciosPorSesion < 1 || brief.ejerciciosPorSesion > 15) return { ok: false, error: "Revisa los datos del brief." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filaPerfil }, bibliotecaBase] = await Promise.all([
    db.from("perfiles_entrenamiento").select("*").eq("alumno_id", brief.alumnoId).maybeSingle(),
    obtenerBiblioteca(),
  ]);

  const perfil: PerfilEntrenamiento = {
    alumnoId: brief.alumnoId,
    objetivoPrincipal: filaPerfil?.objetivo_principal ?? null,
    objetivoSecundario: filaPerfil?.objetivo_secundario ?? null,
    diasDisponibles: filaPerfil?.dias_disponibles ?? null,
    minutosSesion: filaPerfil?.minutos_sesion ?? null,
    experiencia: filaPerfil?.experiencia ?? "principiante",
    cardioNivel: filaPerfil?.cardio_nivel ?? null,
    preferenciaEquipo: filaPerfil?.preferencia_equipo ?? null,
    molestias: filaPerfil?.molestias ?? null,
    lesionesDiagnosticadas: filaPerfil?.lesiones_diagnosticadas ?? null,
    condicionesMedicas: filaPerfil?.condiciones_medicas ?? null,
    medicamentosRelevantes: filaPerfil?.medicamentos_relevantes ?? null,
    requiereRevision: filaPerfil?.requiere_revision ?? false,
  };

  const ids = bibliotecaBase.map((e) => e.id);
  type MetaEjercicio = { id: string; impacto: "bajo" | "medio" | "alto"; requiere_salto: boolean; complejidad: "baja" | "media" | "alta"; requiere_supervision: boolean; posicion_sesion: EjercicioGenerador["posicionSesion"]; etiquetas_precaucion: string[] };
  const { data: metadatos } = await db.from("ejercicios").select("id, impacto, requiere_salto, complejidad, requiere_supervision, posicion_sesion, etiquetas_precaucion").in("id", ids);
  const metaPorId = new Map(((metadatos ?? []) as MetaEjercicio[]).map((m) => [m.id, m]));
  const biblioteca: EjercicioGenerador[] = bibliotecaBase.map((e) => {
    const m = metaPorId.get(e.id);
    return { id: e.id, nombre: e.nombre, grupoMuscular: e.grupoMuscular, categoria: e.categoria, equipo: e.equipo, nivel: e.nivel, impacto: m?.impacto ?? "bajo", requiereSalto: m?.requiere_salto ?? false, complejidad: m?.complejidad ?? "media", requiereSupervision: m?.requiere_supervision ?? false, posicionSesion: m?.posicion_sesion ?? "accesorio", etiquetasPrecaucion: m?.etiquetas_precaucion ?? [] };
  });

  try {
    const generada = generarRutinaPorReglas(perfil, brief, biblioteca);
    const rutina: RutinaExtraida = { nombreRutina: generada.nombreRutina, dias: generada.dias };
    const { data: guardado, error } = await db.from("borradores_generador_rutinas").insert({ alumno_id: brief.alumnoId, entrenador_id: sesion.userId, brief, perfil_snapshot: perfil, resultado: rutina, reglas_aplicadas: generada.reglasAplicadas, alertas: generada.alertas, origen: "motor_reglas" }).select("id").single();
    if (error) console.error("[generador] no se pudo guardar trazabilidad:", error);
    return { ok: true, borradorId: guardado?.id ?? null, rutina, alertas: generada.alertas, reglas: generada.reglasAplicadas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No fue posible generar el borrador." };
  }
}

export async function marcarPerfilRevisado(alumnoId: string): Promise<{ ok: boolean; error?: string }> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from("perfiles_entrenamiento").update({ requiere_revision: false, revisado_por: sesion.userId, revisado_en: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("alumno_id", alumnoId);
  return error ? { ok: false, error: "No se pudo marcar como revisado." } : { ok: true };
}
