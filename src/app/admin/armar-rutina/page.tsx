import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { obtenerTecnicas } from "@/lib/generador-rutinas/data";
import { resolverPlanEntrenamiento } from "@/lib/planes-entrenamiento";
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

  const [{ data: filas }, { data: filasPlan }, { data: perfiles }, ejercicios, tecnicas, { data: rutinasRecientes }, { data: ejerciciosRecientes }] = await Promise.all([
    supabase.from("alumno_perfil").select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)").order("created_at"),
    // Consulta aparte, mismo criterio que el generador: si las columnas del
    // plan fallan en algún entorno, no puede llevarse abajo la lista entera
    // de alumnos.
    supabase.from("alumno_perfil").select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana"),
    db.from("perfiles_entrenamiento").select("alumno_id, dias_disponibles, minutos_sesion, requiere_revision, experiencia, preferencia_equipo, molestias, lesiones_diagnosticadas, operaciones_previas, condiciones_medicas, ejercicios_no_deseados, ejercicios_preferidos"),
    obtenerBiblioteca(),
    // Las técnicas reales del gimnasio: son las que ofrece el selector de
    // técnica de cada ejercicio, incluidas las encadenadas con su cantidad.
    obtenerTecnicas(),
    // "Últimas subidas": historial corto para no tener que ir a buscar en
    // Documentos si una rutina recién publicada llegó bien.
    db
      .from("rutinas")
      .select("id, nombre, created_at, alumno:perfiles!rutinas_alumno_id_fkey(nombre)")
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("ejercicios")
      .select("id, nombre, grupo_muscular, foto_miniatura_url, created_at")
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  type PerfilBreve = {
    alumno_id: string;
    dias_disponibles: number | null;
    minutos_sesion: number | null;
    requiere_revision: boolean;
    experiencia: string | null;
    preferencia_equipo: string | null;
    molestias: string | null;
    lesiones_diagnosticadas: string | null;
    operaciones_previas: string | null;
    condiciones_medicas: string | null;
    ejercicios_no_deseados: string | null;
    ejercicios_preferidos: string | null;
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
        plan: plan ? { codigo: plan.codigo, nombre: plan.nombre, diasSemana: plan.diasSemana } : null,
        // Lo que el alumno escribió en "Mi entrenamiento". El motor no puede
        // leer texto libre, pero el entrenador sí — y tiene que tenerlo
        // delante MIENTRAS arma, no después.
        ficha: {
          experiencia: p?.experiencia ?? null,
          equipo: p?.preferencia_equipo ?? null,
          molestias: p?.molestias ?? null,
          lesiones: p?.lesiones_diagnosticadas ?? null,
          operaciones: p?.operaciones_previas ?? null,
          condiciones: p?.condiciones_medicas ?? null,
          noDeseados: p?.ejercicios_no_deseados ?? null,
          preferidos: p?.ejercicios_preferidos ?? null,
        },
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Sin encabezado grande ni bajada explicativa a propósito: en el celular ese
  // bloque se comía media pantalla, y esta herramienta necesita el alto para la
  // rutina, que es donde está el trabajo real.
  return (
    <div className="space-y-2">
      <h1 className="text-secondary font-bold text-text">Armar rutina</h1>
      <ArmarRutinaPanel
        alumnos={alumnos}
        ejercicios={ejercicios.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          aliases: e.aliases,
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
        ultimasRutinas={(rutinasRecientes ?? []).map((r) => ({
          id: r.id as string,
          nombre: r.nombre as string,
          alumno: (r.alumno as unknown as { nombre: string } | null)?.nombre ?? "Alumno",
          creadaEn: r.created_at as string,
        }))}
        ultimosEjercicios={(ejerciciosRecientes ?? []).map((e) => ({
          id: e.id as string,
          nombre: e.nombre as string,
          grupo: e.grupo_muscular as string,
          fotoUrl: e.foto_miniatura_url as string | null,
          creadoEn: e.created_at as string,
        }))}
      />
    </div>
  );
}
