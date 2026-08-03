import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerTorneosAdmin } from "@/lib/torneos/data";
import { CrearTorneoForm, type BorradorRetoIA } from "@/components/admin/CrearTorneoForm";
import { TorneoAdminCard } from "@/components/admin/TorneoAdminCard";
import { TorneosCerradosGaveta } from "@/components/admin/TorneosCerradosGaveta";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { TituloPestana } from "@/components/admin/TituloPestana";

function sumarDias(fecha: Date, dias: number): string {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia.toISOString().slice(0, 10);
}

export default async function TorneosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const query = await searchParams;
  const valor = (clave: string) => {
    const actual = query[clave];
    return typeof actual === "string" ? actual : "";
  };
  const idsValidos = new Set(alumnos.map((alumno) => alumno.id));
  const desdeIA = valor("ia") === "1";
  const hoy = new Date();
  const borradorIA: BorradorRetoIA | null =
    desdeIA && idsValidos.has(valor("ladoA")) && idsValidos.has(valor("ladoB"))
      ? {
          nombre: valor("nombre").slice(0, 80),
          descripcion: valor("descripcion").slice(0, 500),
          regla: valor("regla").slice(0, 600),
          modalidad: valor("modalidad") === "duelo" ? "duelo" : "duelo",
          metrica: valor("metrica") === "progreso_vip" ? "progreso_vip" : "progreso_vip",
          puntos: Math.max(300, Math.min(1000, Number(valor("puntos")) || 500)),
          ladoA: valor("ladoA"),
          ladoB: valor("ladoB"),
          fechaInicio: sumarDias(hoy, 1),
          fechaFin: sumarDias(hoy, 4),
        }
      : null;

  return (
    <div className="space-y-4">
      <TituloPestana>
        <h1 className="text-h2 text-text">Arena <span className="text-vip">VIP</span></h1>
      </TituloPestana>
      <p className="text-caption text-text-secondary">Competencias oficiales, reglas públicas y premios aportados por VIP Fitness.</p>

      <CrearTorneoForm alumnos={alumnos} borradorIA={borradorIA} />

      {activos.length === 0 && cerrados.length === 0 ? (
        <Card>
          <p className="text-body text-text-secondary">Todavía no publicaste ninguna competencia.</p>
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
          {/* Justo debajo de las que están en curso: cuando una prueba se
              completa y se cierra, se va para acá, plegada. */}
          <TorneosCerradosGaveta torneos={cerrados} />
        </>
      )}
    </div>
  );
}
