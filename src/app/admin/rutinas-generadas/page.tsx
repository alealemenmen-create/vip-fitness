import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import { RutinasGeneradasPanel, type AlumnoConRutinas } from "@/components/admin/RutinasGeneradasPanel";

/** Reabrir una rutina ya publicada y republicarla con cambios. La lista de
 * rutinas se pide por alumno al elegirlo (Server Action), no acá: traer las
 * rutinas de los 68 alumnos en cada carga sería un desperdicio para ver una. */
export default async function RutinasGeneradasPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const [{ data: filas }, { data: filasPlan }, ejercicios, tecnicas] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    supabase.from("alumno_perfil").select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana"),
    obtenerBiblioteca(),
    obtenerTecnicas(),
  ]);

  const planPorAlumno = new Map((filasPlan ?? []).map((f) => [f.user_id, f]));

  const alumnos: AlumnoConRutinas[] = (filas ?? [])
    .map((f) => {
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
        plan: plan ? { codigo: plan.codigo, nombre: plan.nombre } : null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="space-y-2">
      <h1 className="text-secondary font-bold text-text">Rutinas hechas</h1>
      <RutinasGeneradasPanel
        alumnos={alumnos}
        ejercicios={ejercicios.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          grupo: e.grupoMuscular,
          equipo: e.equipo,
          patronMovimiento: e.patronMovimiento,
        }))}
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
    </div>
  );
}
