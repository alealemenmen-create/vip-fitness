import "server-only";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DatosPersonales = {
  nombre: string;
  fechaNacimiento: string | null;
  estaturaCm: number | null;
  condicionMedica: string | null;
  restriccionAlimenticia: string | null;
  // 0032: los completa el formulario público de inscripción y el alumno los
  // puede corregir después desde acá.
  telefono: string | null;
  sexo: string | null;
};

export async function obtenerDatosPersonales(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<DatosPersonales> {
  const [{ data: perfil, error: errorPerfil }, { data: alumnoPerfil, error: errorAlumno }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", alumnoId).single(),
    supabase
      .from("alumno_perfil")
      .select(
        "fecha_nacimiento, estatura_cm, condicion_medica, restriccion_alimenticia, telefono, sexo"
      )
      .eq("user_id", alumnoId)
      .maybeSingle(),
  ]);

  if (errorPerfil || errorAlumno) throw new Error("No fue posible cargar los datos personales.");
  if (!perfil || !alumnoPerfil) throw new Error("El perfil personal está incompleto.");

  return {
    nombre: perfil?.nombre ?? "",
    fechaNacimiento: alumnoPerfil?.fecha_nacimiento ?? null,
    estaturaCm: alumnoPerfil?.estatura_cm ?? null,
    condicionMedica: alumnoPerfil?.condicion_medica ?? null,
    restriccionAlimenticia: alumnoPerfil?.restriccion_alimenticia ?? null,
    telefono: alumnoPerfil?.telefono ?? null,
    sexo: alumnoPerfil?.sexo ?? null,
  };
}
