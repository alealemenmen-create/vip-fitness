import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { GeneradorRutinasPanel } from "@/components/admin/GeneradorRutinasPanel";
import { ArmarRutinaPanel, type AlumnoArmado } from "@/components/admin/ArmarRutinaPanel";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Dumbbell, FileText, FlaskConical, History, WandSparkles } from "lucide-react";

/** La revisión con IA es la operación más larga de toda la app: audita la
 * semana completa contra la ficha del alumno y puede tardar minutos. Sin este
 * tope, la Server Action se corta con el límite por defecto de la plataforma y
 * el entrenador ve un error genérico en vez de la revisión. Va en la página, no
 * en `actions.ts`: según los docs de esta versión de Next, `maxDuration` a
 * nivel de página gobierna todas las Server Actions que se usen en ella. */
export const maxDuration = 300;

export default async function GeneradorPage({
  searchParams,
}: {
  searchParams: Promise<{ alumnos?: string; alumno?: string }>;
}) {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filas }, { data: filasPlan }, { data: perfiles }, { data: rutinasActivas }, ejercicios, tecnicas] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, objetivo, telefono, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    // plan_entrenamiento/sesiones_mensuales/dias_entrenamiento_semana: el plan
    // CONTRATADO (cobrado) del alumno, asignado por el entrenador desde su
    // ficha (ver PerfilAlumnoForm) — distinto de lo que el alumno declaró en
    // su propio cuestionario (dias_disponibles, más abajo), que es autoreporte
    // y puede no coincidir con lo que en verdad pagó. Consulta APARTE de la
    // de arriba a propósito: si esta falla (p. ej. la migración 0064 todavía
    // no corrió en este entorno), no se puede llevar abajo la lista completa
    // de alumnos — mismo criterio que ya usa admin/alumnos/data.ts.
    supabase.from("alumno_perfil").select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana"),
    // La ficha completa, no solo días/minutos: al elegir a la persona el
    // entrenador tiene que ver de una qué le duele, qué le operaron y qué no
    // quiere hacer — "cuando yo elija una persona, tú automáticamente buscas
    // el perfil y ves la información". Antes había que ir a mirarlo aparte.
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
      // Plan contratado — null si todavía no se le asignó uno desde la ficha
      // del entrenador (ver PerfilAlumnoForm en /admin/alumnos/[id]).
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
  }).sort((a,b) => a.nombre.localeCompare(b.nombre, "es"));
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
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vip">Método VIP</p>
        <h1 className="text-lg font-bold text-text">Armar rutina</h1>
        <p className="text-micro text-text-tertiary">Elige al alumno y empieza. Las reglas trabajan mientras tú decides.</p>
      </header>

      <nav className="inline-flex rounded-xl border border-border bg-surface p-1" aria-label="Versiones del generador">
        <span aria-current="page" className="flex items-center gap-2 rounded-lg bg-vip px-3 py-2 text-sm font-bold text-white">
          <WandSparkles size={16} /> Actual
        </span>
        <Link href="/admin/generador-v2" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text">
          <FlaskConical size={16} /> Generador 2.0
        </Link>
      </nav>

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
        <Link href="/admin/ejercicios" className="radius-control flex items-center justify-center gap-1.5 border border-border px-2 py-2 text-caption font-semibold text-text-secondary">
          <Dumbbell size={14} className="text-[#a78bfa]" /> Biblioteca
        </Link>
        <Link href="/admin/documentos" className="radius-control flex items-center justify-center gap-1.5 border border-border px-2 py-2 text-caption font-semibold text-text-secondary">
          <FileText size={14} className="text-[#60a5fa]" /> Importar PDF
        </Link>
        {/* Cuarta forma de llegar a una rutina, y la más barata: partir de una
            que ya se le armó a esa misma persona. */}
        <Link href="/admin/rutinas-generadas" className="radius-control flex items-center justify-center gap-1.5 border border-border px-2 py-2 text-caption font-semibold text-text-secondary">
          <History size={14} className="text-[#f5c26b]" /> Rutinas hechas
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
