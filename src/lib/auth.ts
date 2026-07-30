import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/supabase/types";

export type SesionActual = {
  userId: string;
  nombre: string;
  rol: Rol;
};

export const COOKIE_VISTA_ALUMNO = "vista_alumno_id";

export type ContextoAlumno = {
  alumnoId: string;
  nombre: string;
  rolSesion: Rol;
  soloLectura: boolean;
};

/**
 * Usuario + perfil de la sesión actual, o `null` si no hay sesión válida.
 *
 * Va envuelto en `cache()` de React porque es lo más caro que corre en cada
 * request: `auth.getUser()` es una llamada HTTP aparte al servidor de Auth de
 * Supabase, no una consulta a la base. Sin esto se repetía entera cada vez que
 * alguien llamaba a requireAlumno()/requireRol(), y en /alumno/* se llama dos
 * veces por carga (una en el layout y otra en la página). `cache()` memoriza
 * por request, así que la segunda llamada no cuesta nada.
 */
const obtenerSesion = cache(async (): Promise<SesionActual | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  if (!perfil) return null;

  return { userId: user.id, nombre: perfil.nombre, rol: perfil.rol };
});

/**
 * Verifica sesión + rol en el servidor (no solo oculta botones en la UI).
 * Redirige a /login si no hay sesión o el perfil no tiene uno de los roles permitidos.
 */
export async function requireRol(rolesPermitidos: Rol[]): Promise<SesionActual> {
  const sesion = await obtenerSesion();

  if (!sesion || !rolesPermitidos.includes(sesion.rol)) {
    redirect("/login");
  }

  return sesion;
}

/**
 * Acceso a /alumno/* — se basa en tener una fila en `alumno_perfil`, no en
 * `perfiles.rol`: así un entrenador/admin con perfil de alumno propio también
 * puede entrar (ver plan "vista de entrenador sobre alumnos"). Si quien pide
 * acceso es entrenador/admin y tiene la cookie `vista_alumno_id`, entra en
 * modo solo lectura sobre ese otro alumno en vez de sobre su propia cuenta.
 *
 * También va en `cache()`: el layout de /alumno/* y cada página la llaman por
 * separado, y sin deduplicar eso significaba repetir la sesión entera más la
 * consulta a `alumno_perfil` en cada carga.
 */
export const requireAlumno = cache(async (): Promise<ContextoAlumno> => {
  const sesion = await obtenerSesion();

  if (!sesion) redirect("/login");

  const supabase = await createClient();
  const esEntrenador = sesion.rol === "entrenador" || sesion.rol === "admin";

  if (esEntrenador) {
    const cookieStore = await cookies();
    const vistaAlumnoId = cookieStore.get(COOKIE_VISTA_ALUMNO)?.value;

    if (vistaAlumnoId) {
      const { data: alumno } = await supabase
        .from("alumno_perfil")
        .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)")
        .eq("user_id", vistaAlumnoId)
        .maybeSingle();

      if (alumno) {
        const nombreAlumno =
          (alumno.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno";
        return { alumnoId: vistaAlumnoId, nombre: nombreAlumno, rolSesion: sesion.rol, soloLectura: true };
      }
    }
  }

  const { data: alumnoPerfil } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  if (!alumnoPerfil) {
    redirect(esEntrenador ? "/admin/alumnos" : "/login");
  }

  return {
    alumnoId: sesion.userId,
    nombre: sesion.nombre,
    rolSesion: sesion.rol,
    soloLectura: false,
  };
});
