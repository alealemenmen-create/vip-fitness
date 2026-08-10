import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerTorneosAdmin } from "@/lib/torneos/data";
import { CrearTorneoForm, type BorradorRetoIA } from "@/components/admin/CrearTorneoForm";
import { TorneoAdminCard } from "@/components/admin/TorneoAdminCard";
import { TorneosCerradosGaveta } from "@/components/admin/TorneosCerradosGaveta";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { Archive, Trophy, Users } from "lucide-react";

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
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Competencias"
        title={<>Arena <span className="text-vip">VIP</span></>}
        description="Crea retos oficiales, define reglas públicas y administra los premios de la comunidad."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de Arena VIP">
        <AdminStatCard href="/admin/torneos#torneos-activos" icon={<Trophy size={20} />} value={activos.length} label="En curso" detail="Ver competencias activas" color="#f59e0b" />
        <AdminStatCard href="/admin/torneos#torneos-finalizados" icon={<Archive size={20} />} value={cerrados.length} label="Finalizadas" detail="Abrir historial de retos" color="#a78bfa" />
        <AdminStatCard href="/admin/alumnos" icon={<Users size={20} />} value={alumnos.length} label="Participantes" detail="Ver alumnos disponibles" color="#3b82f6" />
      </section>

      <section id="crear-torneo" className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <CrearTorneoForm alumnos={alumnos} borradorIA={borradorIA} />
      </section>

      <span id="torneos-activos" className="block scroll-mt-28" />
      <span id="torneos-finalizados" className="block scroll-mt-28" />

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
          <div><TorneosCerradosGaveta torneos={cerrados} /></div>
        </>
      )}
    </div>
  );
}
