import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ArmarRutinaPanel, type AlumnoArmado } from "@/components/admin/ArmarRutinaPanel";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Igual que en el generador: la revisión con IA que se puede lanzar desde
 * acá es la operación más larga de la app. Sin este tope la Server Action se
 * corta con el límite por defecto de la plataforma. */
export const maxDuration = 300;

/** Armar rutina a mano — la tercera puerta, al lado del generador automático y
 * de la subida de documentos.
 *
 * El generador pregunta todo antes de generar; acá se pregunta lo mínimo y el
 * trabajo fino se hace después, sobre la rutina ya armada. */
export default async function ArmarRutinaPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: filas }, { data: filasPlan }, { data: perfiles }, ejercicios] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    // Consulta aparte, mismo criterio que el generador: si las columnas del
    // plan fallan en algún entorno, no puede llevarse abajo la lista entera
    // de alumnos.
    supabase.from("alumno_perfil").select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana"),
    db.from("perfiles_entrenamiento").select("alumno_id, dias_disponibles, minutos_sesion, requiere_revision"),
    obtenerBiblioteca(),
  ]);

  type PerfilBreve = {
    alumno_id: string;
    dias_disponibles: number | null;
    minutos_sesion: number | null;
    requiere_revision: boolean;
  };
  const perfilPorAlumno = new Map(((perfiles ?? []) as PerfilBreve[]).map((p) => [p.alumno_id, p]));
  const planPorAlumno = new Map((filasPlan ?? []).map((f) => [f.user_id, f]));

  const alumnos: AlumnoArmado[] = (filas ?? [])
    .map((f) => {
      const p = perfilPorAlumno.get(f.user_id);
      const filaPlan = planPorAlumno.get(f.user_id);
      const plan = resolverPlanEntrenamiento(
        filaPlan?.plan_entrenamiento,
        filaPlan?.sesiones_mensuales,
        filaPlan?.dias_entrenamiento_semana
      );
      const rel = f.perfiles as unknown as { nombre: string } | null;
      return {
        id: f.user_id,
        nombre: rel?.nombre ?? "Alumno",
        perfilCompleto: Boolean(p),
        requiereRevision: Boolean(p?.requiere_revision),
        dias: p?.dias_disponibles ?? null,
        minutos: p?.minutos_sesion ?? null,
        plan: plan ? { nombre: plan.nombre, diasSemana: plan.diasSemana } : null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow="Copiloto VIP"
        title="Armar rutina a mano"
        description="Elegí el alumno y la exigencia, y el motor te deja una base. El resto lo armás vos sobre la rutina, con los mismos ejercicios reales de la sala."
      />
      <ArmarRutinaPanel
        alumnos={alumnos}
        ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo }))}
      />
    </div>
  );
}
