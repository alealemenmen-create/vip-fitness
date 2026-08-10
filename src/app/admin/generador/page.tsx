import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { TituloPestana } from "@/components/admin/TituloPestana";
import { GeneradorRutinasPanel } from "@/components/admin/GeneradorRutinasPanel";
import { BotonRefrescarCatalogo } from "@/components/admin/BotonRefrescarCatalogo";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Dumbbell, FileText } from "lucide-react";

export default async function GeneradorPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filas }, { data: perfiles }, { data: rutinasActivas }, ejercicios, tecnicas] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, objetivo, telefono, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    // La ficha completa, no solo días/minutos: al elegir a la persona el
    // entrenador tiene que ver de una qué le duele, qué le operaron y qué no
    // quiere hacer — "cuando yo elija una persona, tú automáticamente buscas
    // el perfil y ves la información". Antes había que ir a mirarlo aparte.
    db.from("perfiles_entrenamiento").select("alumno_id, dias_disponibles, minutos_sesion, requiere_revision, objetivo_principal, experiencia, cardio_nivel, preferencia_equipo, molestias, lesiones_diagnosticadas, operaciones_previas, condiciones_medicas, medicamentos_relevantes, ejercicios_no_deseados, ejercicios_preferidos, actividades_adicionales"),
    db.from("rutinas").select("alumno_id").eq("activa", true),
    obtenerBiblioteca(),
    obtenerTecnicas(),
  ]);
  type PerfilBreve = {
    alumno_id: string; dias_disponibles: number | null; minutos_sesion: number | null; requiere_revision: boolean;
    objetivo_principal: string | null; experiencia: string | null; cardio_nivel: string | null; preferencia_equipo: string | null;
    molestias: string | null; lesiones_diagnosticadas: string | null; operaciones_previas: string | null;
    condiciones_medicas: string | null; medicamentos_relevantes: string | null;
    ejercicios_no_deseados: string | null; ejercicios_preferidos: string | null; actividades_adicionales: string | null;
  };
  const perfilPorAlumno = new Map(((perfiles ?? []) as PerfilBreve[]).map((p) => [p.alumno_id, p]));
  const conRutinaActiva = new Set(((rutinasActivas ?? []) as { alumno_id: string }[]).map((r) => r.alumno_id));
  const alumnos = (filas ?? []).map((f) => {
    const p = perfilPorAlumno.get(f.user_id);
    const rel = f.perfiles as unknown as { nombre: string } | null;
    return {
      id: f.user_id, nombre: rel?.nombre ?? "Alumno", telefono: f.telefono ?? null, objetivo: f.objetivo,
      perfilCompleto: Boolean(p), requiereRevision: Boolean(p?.requiere_revision),
      dias: p?.dias_disponibles ?? null, minutos: p?.minutos_sesion ?? null,
      sinRutina: !conRutinaActiva.has(f.user_id),
      ficha: {
        objetivoPrincipal: p?.objetivo_principal ?? null,
        experiencia: p?.experiencia ?? null,
        cardioNivel: p?.cardio_nivel ?? null,
        preferenciaEquipo: p?.preferencia_equipo ?? null,
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
  return <><TituloPestana><div><p className="text-caption text-vip">COPILOTO VIP</p><h1 className="text-h3 text-text">Generador de rutinas</h1><p className="text-caption text-text-secondary">Reglas VIP + ejercicios reales + aprobación del entrenador.</p></div></TituloPestana><div className="mb-4 grid grid-cols-2 gap-2"><Link href="/admin/ejercicios" className="radius-control flex items-center justify-center gap-2 border border-border bg-surface py-2 text-caption text-vip"><Dumbbell size={15} />Agregar ejercicio</Link><Link href="/admin/documentos" className="radius-control flex items-center justify-center gap-2 border border-border bg-surface py-2 text-caption text-text-secondary"><FileText size={15} />PDF y documentos</Link><div className="col-span-2"><BotonRefrescarCatalogo /></div></div><GeneradorRutinasPanel alumnos={alumnos} ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo }))} tecnicas={tecnicas.map((t) => ({ slug: t.slug, nombre: t.nombre, tipo: t.tipo, nivelMinimo: t.nivelMinimo }))} /></>;
}
