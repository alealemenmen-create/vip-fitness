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
 * El id del usuario de la sesión actual, o `null` si no hay sesión válida.
 *
 * Va con `getClaims()` y NO con `getUser()`: el proyecto firma los JWT con
 * ES256 (clave asimétrica), así que `getClaims()` verifica la firma localmente
 * con WebCrypto y no sale a la red. `getUser()` consultaba al servidor de Auth
 * de Supabase en cada request — ~84ms medidos desde Chile — y eso se pagaba en
 * cada navegación entre pestañas. Es igual de seguro: verifica la firma
 * criptográficamente (no es `getSession()`, que confía en la cookie a ciegas).
 *
 * `cache()` lo memoriza por request para que el layout y la página no repitan
 * la verificación.
 */
const obtenerUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  // `sub` es el id del usuario, el mismo que devolvía user.id.
  return data?.claims?.sub ?? null;
});

/**
 * Usuario + perfil de la sesión actual, o `null` si no hay sesión válida.
 * Cacheado por request: el layout y la página lo piden por separado.
 */
const obtenerSesion = cache(async (): Promise<SesionActual | null> => {
  const userId = await obtenerUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol")
    .eq("id", userId)
    .single();

  if (!perfil) return null;

  return { userId, nombre: perfil.nombre, rol: perfil.rol };
});

/**
 * Perfil + si el usuario tiene ficha de alumno, en UNA sola consulta.
 *
 * Antes eran dos viajes encadenados (`perfiles` y después `alumno_perfil`,
 * ~95ms cada uno): el segundo no podía empezar hasta que volviera el primero,
 * aunque `alumno_perfil.user_id` apunta a `perfiles.id` y PostgREST sabe
 * traerlos juntos. Se piden anidados y queda un solo round-trip.
 */
const obtenerSesionConAlumno = cache(
  async (): Promise<{ sesion: SesionActual; esAlumno: boolean } | null> => {
    const userId = await obtenerUserId();
    if (!userId) return null;

    const supabase = await createClient();
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, rol, alumno_perfil!alumno_perfil_user_id_fkey(user_id)")
      .eq("id", userId)
      .single();

    if (!perfil) return null;

    // PostgREST devuelve la relación como arreglo o como objeto según la
    // cardinalidad que infiera; `alumno_perfil.user_id` es primary key, así
    // que puede venir de cualquiera de las dos formas.
    const ficha = perfil.alumno_perfil as unknown;
    const esAlumno = Array.isArray(ficha) ? ficha.length > 0 : ficha !== null;

    return {
      sesion: { userId, nombre: perfil.nombre, rol: perfil.rol },
      esAlumno,
    };
  }
);

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
  const contexto = await obtenerSesionConAlumno();

  if (!contexto) redirect("/login");

  const { sesion, esAlumno } = contexto;
  const esEntrenador = sesion.rol === "entrenador" || sesion.rol === "admin";

  if (esEntrenador) {
    const cookieStore = await cookies();
    const vistaAlumnoId = cookieStore.get(COOKIE_VISTA_ALUMNO)?.value;

    if (vistaAlumnoId) {
      const supabase = await createClient();
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

  if (!esAlumno) {
    redirect(esEntrenador ? "/admin/alumnos" : "/login");
  }

  return {
    alumnoId: sesion.userId,
    nombre: sesion.nombre,
    rolSesion: sesion.rol,
    soloLectura: false,
  };
});
