import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { OtorgarPuntosPanel } from "@/components/admin/OtorgarPuntosPanel";
import { RecompensasAdminPanel } from "@/components/admin/RecompensasAdminPanel";
import { obtenerAdminRecompensasVip } from "@/lib/recompensas/data";

/** Otorgar Puntos VIP a mano.
 *
 * Nació de un caso real: un bug de las rutinas le comió 300 puntos a una
 * alumna que sí había entrenado. Sin esta pantalla, la única forma de
 * devolvérselos era escribir en la base de datos a mano — algo que el
 * entrenador no puede hacer solo y que no deja rastro de por qué se hizo. */
export default async function PuntosPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre, rol)")
    .order("created_at");

  const alumnos = (data ?? [])
    .filter((f) => (f.perfiles as unknown as { rol: string } | null)?.rol === "alumno")
    .map((f) => ({
      id: f.user_id,
      nombre: nombreAlumnoPublicado((f.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const recompensas = await obtenerAdminRecompensasVip();

  return (
    <div className="space-y-2">
      <h1 className="text-secondary font-bold text-text">Otorgar puntos</h1>
      <p className="text-micro text-text-tertiary">
        Para reponer puntos que se perdieron por una falla, o premiar algo puntual. Suman en el ranking igual que los
        que gana entrenando, y el alumno ve el motivo que escribas.
      </p>
      <OtorgarPuntosPanel alumnos={alumnos} />
      <div className="pt-4"><RecompensasAdminPanel {...recompensas} /></div>
    </div>
  );
}
