import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { TituloPestana } from "@/components/admin/TituloPestana";
import { GeneradorRutinasPanel } from "@/components/admin/GeneradorRutinasPanel";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Dumbbell, FileText } from "lucide-react";

export default async function GeneradorPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: filas }, { data: perfiles }, ejercicios] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, objetivo, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    db.from("perfiles_entrenamiento").select("alumno_id, dias_disponibles, minutos_sesion, requiere_revision"),
    obtenerBiblioteca(),
  ]);
  type PerfilBreve = { alumno_id: string; dias_disponibles: number | null; minutos_sesion: number | null; requiere_revision: boolean };
  const perfilPorAlumno = new Map(((perfiles ?? []) as PerfilBreve[]).map((p) => [p.alumno_id, p]));
  const alumnos = (filas ?? []).map((f) => { const p = perfilPorAlumno.get(f.user_id); const rel = f.perfiles as unknown as { nombre: string } | null; return { id: f.user_id, nombre: rel?.nombre ?? "Alumno", objetivo: f.objetivo, perfilCompleto: Boolean(p), requiereRevision: Boolean(p?.requiere_revision), dias: p?.dias_disponibles ?? null, minutos: p?.minutos_sesion ?? null }; }).sort((a,b) => a.nombre.localeCompare(b.nombre, "es"));
  return <><TituloPestana><div><p className="text-caption text-vip">COPILOTO VIP</p><h1 className="text-h3 text-text">Generador de rutinas</h1><p className="text-caption text-text-secondary">Reglas VIP + ejercicios reales + aprobación del entrenador.</p></div></TituloPestana><div className="mb-4 grid grid-cols-2 gap-2"><Link href="/admin/ejercicios" className="radius-control flex items-center justify-center gap-2 border border-border bg-surface py-2 text-caption text-vip"><Dumbbell size={15} />Agregar ejercicio</Link><Link href="/admin/documentos" className="radius-control flex items-center justify-center gap-2 border border-border bg-surface py-2 text-caption text-text-secondary"><FileText size={15} />PDF y documentos</Link></div><GeneradorRutinasPanel alumnos={alumnos} ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo }))} /></>;
}
