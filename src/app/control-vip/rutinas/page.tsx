import Link from "next/link";
import { Dumbbell, FileText, History, WandSparkles } from "lucide-react";
import { requireControlVipV2 } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { GeneradorRutinasPanel } from "@/components/admin/GeneradorRutinasPanel";
import { ArmarRutinaPanel, type AlumnoArmado } from "@/components/admin/ArmarRutinaPanel";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;

/**
 * Rutinas de Control VIP V2 (docs/PROYECTO_CONTROL_VIP_V2.md, Fase 3).
 * Misma composición y datos que `/admin/generador` — Armar rutina (manual)
 * como modo principal, Generador por cuestionario plegado debajo, ambos
 * sobre el mismo motor VIP sin tocarlo — porque esa página ya es, en la
 * práctica, la unificación que pide el documento (Manual + Generador en una
 * sola pantalla; Reutilizar e Importar a un toque).
 *
 * El selector de alumno "común" entre los cuatro modos no es nuevo: ya
 * existe `src/lib/admin/ultimo-alumno-local.ts`, una clave compartida que
 * Armar rutina, Documentos y Rutinas hechas ya leen y escriben (instructivo
 * §9.1). Lo único que faltaba era que la ficha del alumno la alimentara al
 * entrar acá — eso lo resuelve `BotonRutinaFicha` en la ficha de Control VIP
 * V2, no este archivo.
 */
export default async function ControlVipV2RutinasPage({
  searchParams,
}: {
  searchParams: Promise<{ alumnos?: string; alumno?: string }>;
}) {
  await requireControlVipV2();
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filas }, { data: filasPlan }, { data: perfiles }, { data: rutinasActivas }, ejercicios, tecnicas] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, objetivo, telefono, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    supabase.from("alumno_perfil").select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana"),
    db.from("perfiles_entrenamiento").select("alumno_id, dias_disponibles, minutos_sesion, requiere_revision, objetivo_principal, experiencia, cardio_nivel, preferencia_equipo, categoria_competencia, molestias, lesiones_diagnosticadas, operaciones_previas, condiciones_medicas, medicamentos_relevantes, ejercicios_no_deseados, ejercicios_preferidos, actividades_adicionales"),
    db.from("rutinas").select("alumno_id").eq("activa", true),
    obtenerBiblioteca(),
    obtenerTecnicas(),
  ]);
  type PerfilBreve = {
    alumno_id: string; dias_disponibles: number | null; minutos_sesion: number | null; requiere_revision: boolean;
    objetivo_principal: string | null; experiencia: string | null; cardio_nivel: string | null; preferencia_equipo: string | null;
    categoria_competencia: import("@/lib/generador-rutinas/tipos").CategoriaCompetencia | null;
    molestias: string | null; lesiones_diagnosticadas: string | null; operaciones_previas: string | null;
    condiciones_medicas: string | null; medicamentos_relevantes: string | null;
    ejercicios_no_deseados: string | null; ejercicios_preferidos: string | null; actividades_adicionales: string | null;
  };
  const perfilPorAlumno = new Map(((perfiles ?? []) as PerfilBreve[]).map((p) => [p.alumno_id, p]));
  const conRutinaActiva = new Set(((rutinasActivas ?? []) as { alumno_id: string }[]).map((r) => r.alumno_id));
  const planPorAlumno = new Map((filasPlan ?? []).map((f) => [f.user_id, f]));
  const alumnos = (filas ?? []).map((f) => {
    const p = perfilPorAlumno.get(f.user_id);
    const rel = f.perfiles as unknown as { nombre: string } | null;
    const filaPlan = planPorAlumno.get(f.user_id);
    const plan = resolverPlanEntrenamiento(filaPlan?.plan_entrenamiento, filaPlan?.sesiones_mensuales, filaPlan?.dias_entrenamiento_semana);
    return {
      id: f.user_id, nombre: rel?.nombre ?? "Alumno", telefono: f.telefono ?? null, objetivo: f.objetivo,
      perfilCompleto: Boolean(p), requiereRevision: Boolean(p?.requiere_revision),
      dias: p?.dias_disponibles ?? null, minutos: p?.minutos_sesion ?? null,
      plan: plan ? { codigo: plan.codigo, nombre: plan.nombre, diasSemana: plan.diasSemana, sesionesMensuales: plan.sesionesMensuales } : null,
      sinRutina: !conRutinaActiva.has(f.user_id),
      ficha: {
        objetivoPrincipal: p?.objetivo_principal ?? null,
        experiencia: p?.experiencia ?? null,
        cardioNivel: p?.cardio_nivel ?? null,
        preferenciaEquipo: p?.preferencia_equipo ?? null,
        categoriaReferencia: p?.categoria_competencia ?? null,
        molestias: p?.molestias ?? null,
        lesiones: p?.lesiones_diagnosticadas ?? null,
        operaciones: p?.operaciones_previas ?? null,
        condiciones: p?.condiciones_medicas ?? null,
        medicamentos: p?.medicamentos_relevantes ?? null,
        noDeseados: p?.ejercicios_no_deseados ?? null,
        preferidos: p?.ejercicios_preferidos ?? null,
        actividades: p?.actividades_adicionales ?? null,
      },
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const alumnosArmado: AlumnoArmado[] = alumnos.map((alumno) => ({
    id: alumno.id,
    nombre: alumno.nombre,
    perfilCompleto: alumno.perfilCompleto,
    requiereRevision: alumno.requiereRevision,
    dias: alumno.dias,
    minutos: alumno.minutos,
    plan: alumno.plan ? { codigo: alumno.plan.codigo, nombre: alumno.plan.nombre, diasSemana: alumno.plan.diasSemana } : null,
    ficha: {
      experiencia: alumno.ficha.experiencia,
      equipo: alumno.ficha.preferenciaEquipo,
      molestias: alumno.ficha.molestias,
      lesiones: alumno.ficha.lesiones,
      operaciones: alumno.ficha.operaciones,
      condiciones: alumno.ficha.condiciones,
      noDeseados: alumno.ficha.noDeseados,
      preferidos: alumno.ficha.preferidos,
    },
  }));
  const query = await searchParams;
  const filtroAlumnos = query.alumnos === "sin_rutina" || query.alumnos === "ficha_lista"
    ? query.alumnos
    : "todos";

  return (
    <div className="space-y-3 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Rutinas"
        description="Elegí al alumno y empezá. Manual o por cuestionario, mismo motor VIP de siempre."
      />

      <ArmarRutinaPanel
        alumnos={alumnosArmado}
        ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo, patronMovimiento: e.patronMovimiento }))}
        tecnicas={tecnicas.map((t) => ({
          nombre: t.nombre,
          descripcion: t.descripcion,
          tipo: t.tipo,
          cantidadEjercicios: t.cantidadEjercicios,
          descansoInternoSeg: t.descansoInternoSeg,
          descansoFinalSeg: t.descansoFinalSeg,
          fatiga: t.fatiga,
          requiereSupervision: t.requiereSupervision,
        }))}
      />

      <div className="grid grid-cols-3 gap-2">
        <Link href="/control-vip/galeria" className="boton-panel-secundario">
          <Dumbbell size={14} /> Biblioteca
        </Link>
        <Link href="/admin/documentos" className="boton-panel-secundario">
          <FileText size={14} /> Importar PDF
        </Link>
        <Link href="/admin/rutinas-generadas" className="boton-panel-secundario">
          <History size={14} /> Rutinas hechas
        </Link>
      </div>

      <details className="radius-control border border-border bg-surface">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-caption font-semibold text-text-secondary">
          <WandSparkles size={14} className="text-vip" /> Generador por cuestionario · opcional
        </summary>
        <div className="border-t border-border p-3">
          <GeneradorRutinasPanel
            key={`${filtroAlumnos}:${query.alumno ?? ""}`}
            alumnos={alumnos}
            filtroInicial={filtroAlumnos}
            alumnoInicial={alumnos.some((alumno) => alumno.id === query.alumno) ? query.alumno : undefined}
            ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo, patronMovimiento: e.patronMovimiento }))}
            tecnicas={tecnicas.map((t) => ({ slug: t.slug, nombre: t.nombre, tipo: t.tipo, nivelMinimo: t.nivelMinimo }))}
          />
        </div>
      </details>
    </div>
  );
}
