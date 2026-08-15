import { Lock } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Logo } from "@/components/Logo";

/** Pantalla que ve un alumno con `alumno_perfil.acceso_bloqueado = true` (ej.
 * membresía sin pagar) en vez del resto de la app. Fuera de /alumno/* a
 * propósito: no hereda el layout con bottom nav ni el resto de los gates.
 *
 * Usa `requireRol` y NO `requireAlumno`: ese último es justo el que
 * redirige para acá cuando el acceso está bloqueado — llamarlo acá crearía
 * un bucle infinito de redirects. Acepta los tres roles porque una cuenta
 * dual (entrenador con ficha de alumno propia, `perfiles.rol = 'entrenador'`)
 * también puede llegar acá si su propio acceso de alumno está bloqueado. */
export default async function AccesoBloqueadoPage() {
  const contexto = await requireRol(["alumno", "entrenador", "admin"]);
  const supabase = await createClient();
  const { data: entrenador } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("rol", "entrenador")
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Logo compact />
      <div className="grid size-14 place-items-center rounded-full bg-warning/10 text-warning">
        <Lock size={26} />
      </div>
      <div className="max-w-xs space-y-2">
        <h1 className="text-card-title font-bold text-text">Tu acceso está pausado</h1>
        <p className="text-caption leading-relaxed text-text-secondary">
          Hola {contexto.nombre.split(" ")[0]}, tu entrenador{entrenador ? ` (${entrenador.nombre})` : ""} pausó
          temporalmente tu acceso a la app. Contactalo para resolverlo y volver a entrenar.
        </p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="radius-control border border-border px-5 py-2.5 text-caption font-semibold text-text-secondary"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
