import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { GeneradorRutinasPanel } from "@/components/admin/GeneradorRutinasPanel";
import { BotonRefrescarCatalogo } from "@/components/admin/BotonRefrescarCatalogo";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { BookOpenCheck, Dumbbell, FileText, Users, WandSparkles } from "lucide-react";

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
  const sinRutina = alumnos.filter((alumno) => alumno.sinRutina).length;
  const fichasCompletas = alumnos.filter((alumno) => alumno.perfilCompleto).length;
  const query = await searchParams;
  const filtroAlumnos = query.alumnos === "sin_rutina" || query.alumnos === "ficha_lista"
    ? query.alumnos
    : "todos";

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Copiloto VIP"
        title="Generador de rutinas"
        description="Configura, revisa y aprueba rutinas con las reglas del Método VIP y ejercicios reales."
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumen del generador">
        <AdminStatCard href="/admin/generador?alumnos=todos#selector-alumnos" icon={<Users size={20} />} value={alumnos.length} label="Alumnos" detail="Ver todos para planificar" color="#3b82f6" />
        <AdminStatCard href="/admin/generador?alumnos=sin_rutina#selector-alumnos" icon={<WandSparkles size={20} />} value={sinRutina} label="Sin rutina" detail="Ver quiénes están pendientes" color="#ef4444" />
        <AdminStatCard href="/admin/generador?alumnos=ficha_lista#selector-alumnos" icon={<BookOpenCheck size={20} />} value={fichasCompletas} label="Fichas listas" detail="Ver alumnos con precarga" color="#22c55e" />
        <AdminStatCard href="/admin/ejercicios#biblioteca-ejercicios" icon={<Dumbbell size={20} />} value={ejercicios.length} label="Ejercicios" detail="Abrir catálogo disponible" color="#a78bfa" />
      </section>

      <section className="admin-panel-card rounded-3xl p-4" aria-label="Herramientas del generador">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-text">Herramientas rápidas</h2>
          <p className="text-[11px] text-text-tertiary">Mantén el catálogo y los documentos cerca del proceso.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href="/admin/ejercicios" className="radius-control flex items-center justify-center gap-2 border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-2.5 text-xs font-semibold text-[#a78bfa]">
            <Dumbbell size={15} /> Agregar ejercicio
          </Link>
          <Link href="/admin/documentos" className="radius-control flex items-center justify-center gap-2 border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-3 py-2.5 text-xs font-semibold text-[#60a5fa]">
            <FileText size={15} /> PDF y documentos
          </Link>
          <div><BotonRefrescarCatalogo /></div>
        </div>
      </section>

      <GeneradorRutinasPanel
        key={`${filtroAlumnos}:${query.alumno ?? ""}`}
        alumnos={alumnos}
        filtroInicial={filtroAlumnos}
        alumnoInicial={alumnos.some((alumno) => alumno.id === query.alumno) ? query.alumno : undefined}
        ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo }))}
        tecnicas={tecnicas.map((t) => ({ slug: t.slug, nombre: t.nombre, tipo: t.tipo, nivelMinimo: t.nivelMinimo }))}
      />
    </div>
  );
}
