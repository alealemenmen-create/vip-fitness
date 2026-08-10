import { redirect } from "next/navigation";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { leerFicha } from "@/lib/perfil-alumno/datos";
import { fichaCompleta } from "@/lib/perfil-alumno/ficha";
import { FichaAlumnoForm } from "@/components/student/FichaAlumnoForm";
import { Logo } from "@/components/Logo";
import { guardarMiFicha } from "./actions";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cuestionario de ingreso: la primera pantalla que ve alguien que todavía no
 * llenó su ficha, sea un alumno nuevo o uno de siempre después de esta
 * actualización.
 *
 * Vive FUERA de `/alumno` a propósito. El bloqueo está en el layout de
 * `/alumno`, así que si esta pantalla colgara de ahí se redirigiría a sí misma
 * en bucle. Acá también significa que no hay barra de navegación: no hay a
 * dónde ir hasta contestar, que es justamente lo que se pidió. */
export default async function CompletarPerfilPage() {
  const { alumnoId, nombre, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const ficha = await leerFicha(supabase as unknown as SupabaseClient, alumnoId);

  // Ya la tiene completa (o entró de casualidad): no hay nada que preguntar.
  if (soloLectura || fichaCompleta(ficha)) redirect("/alumno/inicio");

  const primerNombre = nombre?.trim().split(/\s+/)[0] ?? "";
  const esPrimeraVez = !ficha.completadoEn;

  // Mismo andamiaje de scroll que el layout de alumno: `html`/`body` tienen
  // `overflow: hidden` en toda la app (ver .pantalla-scroll en globals.css),
  // así que una página suelta no scrollea y el formulario quedaría cortado
  // debajo del pliegue. El scroll va en un hijo, no en el documento.
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <div className="mx-auto w-full max-w-md shrink-0 px-4 pt-1">
        <Logo compact />
      </div>
      <div className="pantalla-scroll mx-auto w-full max-w-md px-4 pb-16">
        <div className="mb-4 mt-2">
        <p className="text-caption text-vip">ANTES DE EMPEZAR</p>
        <h1 className="text-h3 text-text">
          {esPrimeraVez ? `Hola${primerNombre ? ` ${primerNombre}` : ""}, cuéntanos de ti` : "Completa tu ficha"}
        </h1>
        <p className="text-body mt-1.5 text-text-secondary">
          {esPrimeraVez
            ? "Son un par de minutos, una sola vez. Con esto tu entrenador arma una rutina pensada para ti —tu objetivo, tus días, tu nivel y lo que tu cuerpo necesita cuidar— y no una rutina genérica."
            : "Actualizamos la app y necesitamos algunos datos que faltaban para poder armarte mejores rutinas. Es rápido y queda guardado."}
        </p>
      </div>

        <FichaAlumnoForm ficha={ficha} accion={guardarMiFicha} modo="ingreso" />
      </div>
    </div>
  );
}
