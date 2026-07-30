import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerTorneosAdmin } from "@/lib/torneos/data";
import { CrearTorneoForm } from "@/components/admin/CrearTorneoForm";
import { TorneoAdminCard } from "@/components/admin/TorneoAdminCard";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function TorneosPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: alumnosData } = await supabase
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre, rol)");

  const alumnos = (alumnosData ?? [])
    .filter((a) => (a.perfiles as unknown as { rol: string } | null)?.rol === "alumno")
    .map((a) => ({
      id: a.user_id,
      nombre: nombreAlumnoPublicado(
        (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"
      ),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const torneos = await obtenerTorneosAdmin();
  const activos = torneos.filter((t) => !t.cerrado);
  const cerrados = torneos.filter((t) => t.cerrado);

  return (
    <div className="space-y-4">
      <h1 className="text-h2 text-text">Torneos</h1>

      <CrearTorneoForm alumnos={alumnos} />

      {activos.length === 0 && cerrados.length === 0 ? (
        <Card>
          <p className="text-body text-text-secondary">Todavía no creaste ningún torneo.</p>
        </Card>
      ) : (
        <>
          {activos.length > 0 && (
            <div className="space-y-3">
              <p className="text-caption text-text-tertiary">EN CURSO</p>
              {activos.map((t) => (
                <TorneoAdminCard key={t.id} torneo={t} />
              ))}
            </div>
          )}
          {cerrados.length > 0 && (
            <div className="space-y-3">
              <p className="text-caption text-text-tertiary">CERRADOS</p>
              {cerrados.map((t) => (
                <TorneoAdminCard key={t.id} torneo={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
