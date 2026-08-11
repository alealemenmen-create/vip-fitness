"use server";

import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calcularEdad } from "@/lib/date";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { generarRutinaPorReglas } from "@/lib/generador-rutinas/motor";
import { combinarPerfilesGrupo } from "@/lib/generador-rutinas/perfil-grupal";
import type { BriefGenerador, EjercicioGenerador, PerfilEntrenamiento } from "@/lib/generador-rutinas/tipos";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import { revisarRutinaGenerada, type RevisionResuelta } from "@/lib/ai/revisarRutina";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoGeneracion = { ok: true; borradorId: string | null; rutina: RutinaExtraida; alertas: string[]; reglas: string[] } | { ok: false; error: string };

/** Todo lo que hace falta saber del alumno para generar Y para revisar: se
 * arma una sola vez y lo usan las dos acciones. La revisión de IA tiene que
 * leer el perfil del servidor, nunca uno que llegue del cliente. */
type ContextoAlumno = {
  perfil: PerfilEntrenamiento;
  biblioteca: EjercicioGenerador[];
  tecnicas: Awaited<ReturnType<typeof obtenerTecnicas>>;
  nombreAlumno: string | null;
  rutinasPrevias: number;
};

async function cargarContextoAlumno(db: SupabaseClient, alumnoId: string): Promise<ContextoAlumno> {
  const [{ data: filaPerfil }, { data: filaAlumno }, { count: rutinasPrevias }, { data: rutinaActiva }, bibliotecaBase, tecnicas] = await Promise.all([
    db.from("perfiles_entrenamiento").select("*").eq("alumno_id", alumnoId).maybeSingle(),
    // `sexo`/`fecha_nacimiento` viven en alumno_perfil, no en perfiles (igual
    // que `telefono` en el generador/page.tsx) — confundirlas hacía fallar
    // todo el select y dejaba `perfil.sexo` siempre en null, sin ningún
    // error visible.
    db.from("alumno_perfil").select("sexo, fecha_nacimiento, perfiles!alumno_perfil_user_id_fkey(nombre)").eq("user_id", alumnoId).maybeSingle(),
    db.from("rutinas").select("id", { count: "exact", head: true }).eq("alumno_id", alumnoId),
    // Última rutina activa con sus ejercicios, para no repetirle exactamente
    // lo mismo — "que la persona sienta que hay un cambio".
    db
      .from("rutinas")
      .select("rutina_dias(rutina_dia_ejercicios(ejercicio_id))")
      .eq("alumno_id", alumnoId)
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    obtenerBiblioteca(),
    obtenerTecnicas(),
  ]);
  const nombreAlumno = (filaAlumno?.perfiles as unknown as { nombre: string } | null)?.nombre ?? null;
  type RutinaActivaAnidada = { rutina_dias: { rutina_dia_ejercicios: { ejercicio_id: string | null }[] }[] } | null;
  const ejerciciosRecientes = ((rutinaActiva as RutinaActivaAnidada)?.rutina_dias ?? [])
    .flatMap((d) => d.rutina_dia_ejercicios)
    .map((e) => e.ejercicio_id)
    .filter((id): id is string => id !== null);

  const perfil: PerfilEntrenamiento = {
    alumnoId,
    sexo: filaAlumno?.sexo ?? null,
    edad: filaAlumno?.fecha_nacimiento ? calcularEdad(filaAlumno.fecha_nacimiento) : null,
    ejerciciosRecientes,
    objetivoPrincipal: filaPerfil?.objetivo_principal ?? null,
    objetivoSecundario: filaPerfil?.objetivo_secundario ?? null,
    diasDisponibles: filaPerfil?.dias_disponibles ?? null,
    minutosSesion: filaPerfil?.minutos_sesion ?? null,
    experiencia: filaPerfil?.experiencia ?? "principiante",
    cardioNivel: filaPerfil?.cardio_nivel ?? null,
    preferenciaEquipo: filaPerfil?.preferencia_equipo ?? null,
    ayudasErgogenicas: filaPerfil?.ayudas_ergogenicas ?? "prefiere_no_decir",
    categoriaCompetencia: filaPerfil?.categoria_competencia ?? "ninguna",
    estiloEntrenamiento: filaPerfil?.estilo_entrenamiento ?? "hibrido",
    intensidadDeseada: filaPerfil?.intensidad_deseada ?? "estandar",
    molestias: filaPerfil?.molestias ?? null,
    lesionesDiagnosticadas: filaPerfil?.lesiones_diagnosticadas ?? null,
    condicionesMedicas: filaPerfil?.condiciones_medicas ?? null,
    medicamentosRelevantes: filaPerfil?.medicamentos_relevantes ?? null,
    operacionesPrevias: filaPerfil?.operaciones_previas ?? null,
    actividadesAdicionales: filaPerfil?.actividades_adicionales ?? null,
    ejerciciosPreferidos: filaPerfil?.ejercicios_preferidos ?? null,
    ejerciciosNoDeseados: filaPerfil?.ejercicios_no_deseados ?? null,
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

  return { perfil, biblioteca, tecnicas, nombreAlumno, rutinasPrevias: rutinasPrevias ?? 0 };
}

export async function generarBorradorRutina(brief: BriefGenerador): Promise<ResultadoGeneracion> {
  const sesion = await requireRol(["entrenador", "admin"]);
  if (!brief.alumnoId || brief.dias < 1 || brief.dias > 7 || brief.ejerciciosPorSesion < 1 || brief.ejerciciosPorSesion > 15) return { ok: false, error: "Revisa los datos del brief." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const alumnoIds = [...new Set((brief.alumnoIds?.length ? brief.alumnoIds : [brief.alumnoId]).filter(Boolean))];
  const contextos = await Promise.all(alumnoIds.map((id) => cargarContextoAlumno(db, id)));
  const perfil = combinarPerfilesGrupo(contextos.map((c) => c.perfil));
  const { biblioteca, tecnicas, nombreAlumno, rutinasPrevias } = contextos[0];

  try {
    const generada = generarRutinaPorReglas(perfil, brief, biblioteca, tecnicas);
    if (contextos.length > 1) {
      generada.reglasAplicadas.push(`Rutina grupal calibrada con ${contextos.length} perfiles: se usó el nivel menos experimentado y se unieron las restricciones de todos`);
      const niveles = new Set(contextos.map((c) => c.perfil.experiencia));
      if (niveles.size > 1) generada.alertas.push("El grupo tiene niveles de experiencia diferentes; la rutina se calibró con el nivel más conservador.");
      if (contextos.some((c) => c.perfil.requiereRevision)) generada.alertas.push("Al menos un integrante del grupo tiene antecedentes pendientes de revisión.");
    }
    // "Plan hipertrofia — Angie Avalos — v3": versión = cuántas rutinas tuvo
    // antes esta persona + 1, así el nombre solo ya dice si es la primera vez
    // o un ajuste sobre una rutina anterior — sin tener que abrir el historial.
    const version = rutinasPrevias + 1;
    const nombreConVersion = contextos.length > 1
      ? `${generada.nombreRutina} — Grupo de ${contextos.length} — v${version}`
      : nombreAlumno ? `${generada.nombreRutina} — ${nombreAlumno} — v${version}` : generada.nombreRutina;
    const rutina: RutinaExtraida = { nombreRutina: nombreConVersion, dias: generada.dias };
    const { data: guardado, error } = await db.from("borradores_generador_rutinas").insert({ alumno_id: brief.alumnoId, entrenador_id: sesion.userId, brief, perfil_snapshot: perfil, resultado: rutina, reglas_aplicadas: generada.reglasAplicadas, alertas: generada.alertas, origen: "motor_reglas" }).select("id").single();
    if (error) console.error("[generador] no se pudo guardar trazabilidad:", error);
    return { ok: true, borradorId: guardado?.id ?? null, rutina, alertas: generada.alertas, reglas: generada.reglasAplicadas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No fue posible generar el borrador." };
  }
}

export type ResultadoRevision = { ok: true; revision: RevisionResuelta } | { ok: false; error: string };

/** Segunda pasada sobre el borrador — la IA lo cruza con la ficha real del
 * alumno y propone cambios. Se llama DESPUÉS de generar (y de que el
 * entrenador edite a mano si quiso), nunca en lugar del motor.
 *
 * La rutina llega del cliente a propósito: es la que el entrenador tiene en
 * pantalla, con sus ediciones. El perfil, en cambio, se relee del servidor —
 * es el dato sensible y no puede venir del navegador. */
export async function revisarBorradorConIA(params: {
  alumnoId: string;
  alumnoIds?: string[];
  brief: BriefGenerador;
  rutina: RutinaExtraida;
  reglas: string[];
  borradorId: string | null;
}): Promise<ResultadoRevision> {
  const sesion = await requireRol(["entrenador", "admin"]);
  if (!params.alumnoId || !params.rutina?.dias?.length) return { ok: false, error: "No hay una rutina que revisar." };
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const alumnoIds = [...new Set((params.alumnoIds?.length ? params.alumnoIds : [params.alumnoId]).filter(Boolean))];
  const contextos = await Promise.all(alumnoIds.map((id) => cargarContextoAlumno(db, id)));
  const perfil = combinarPerfilesGrupo(contextos.map((c) => c.perfil));
  const { biblioteca } = contextos[0];

  const resultado = await revisarRutinaGenerada({
    rutina: params.rutina,
    perfil,
    brief: params.brief,
    biblioteca,
    reglasAplicadas: params.reglas,
    // Para el contador de consumo: la revisión es lo más caro que corre la
    // app y quien la dispara es siempre el entrenador que está en pantalla.
    entrenadorId: sesion.userId,
  });
  if (!resultado.ok) return resultado;

  // La revisión queda pegada al borrador para poder auditar después por qué
  // se publicó una rutina con tal cambio (o sin él).
  if (params.borradorId) {
    const { error } = await db
      .from("borradores_generador_rutinas")
      .update({ revision_ia: resultado.revision })
      .eq("id", params.borradorId);
    if (error) console.error("[generador] no se pudo guardar la revisión de IA:", error);
  }

  return { ok: true, revision: resultado.revision };
}

export async function marcarPerfilRevisado(alumnoId: string): Promise<{ ok: boolean; error?: string }> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from("perfiles_entrenamiento").update({ requiere_revision: false, revisado_por: sesion.userId, revisado_en: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("alumno_id", alumnoId);
  return error ? { ok: false, error: "No se pudo marcar como revisado." } : { ok: true };
}
