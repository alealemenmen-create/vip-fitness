import { Activity, AlertTriangle, CircleCheck, Dumbbell, Sparkles, Star, UserCog, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { CrearAlumnoForm } from "@/components/admin/CrearAlumnoForm";
import { InvitarEntrenadorForm } from "@/components/admin/InvitarEntrenadorForm";
import { ListaAlumnos, type FiltroAlumnos } from "@/components/admin/ListaAlumnos";
import { ListaEntrenadores } from "@/components/admin/ListaEntrenadores";
import { AvisosNotasIA } from "@/components/admin/AvisosNotasIA";
import { AvisoSolicitudes } from "@/components/admin/AvisoSolicitudes";
import { SugerenciasHoy } from "@/components/admin/SugerenciasHoy";
import { obtenerReportes, obtenerAvisosNotasIA, type EstadoAlumno } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { TituloPestana } from "@/components/admin/TituloPestana";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AsistenciaImpulsoEnVivo } from "@/components/admin/AsistenciaImpulsoEnVivo";
import { obtenerSolicitudesAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import { obtenerResumenMemoriaImpulso } from "@/lib/impulso-vip/memoria-data";
import { MemoriaImpulsoVIP } from "@/components/admin/MemoriaImpulsoVIP";

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  // Cualquier entrenador ve a todos los alumnos (equipo de confianza, sin
  // asignación exclusiva) — ver migración 0005_entrenador_acceso_total.sql.
  const { data: alumnosData } = await supabase
    .from("alumno_perfil")
    .select("user_id, objetivo, perfiles!alumno_perfil_user_id_fkey(nombre, rol)");

  // Se incluye al propio entrenador si activó su perfil de alumno dual —
  // necesita poder entrar a su propia ficha para subirse rutina/alimentación.
  const alumnos = (alumnosData ?? [])
    .filter((a) => {
      const rol = (a.perfiles as unknown as { rol: string } | null)?.rol;
      return rol === "alumno" || a.user_id === sesion.userId;
    })
    .map((a) => ({
      id: a.user_id,
      nombre: nombreAlumnoPublicado(
        (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"
      ),
      objetivo: a.objetivo,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  // La lista de entrenadores no depende de los reportes: iba suelta después
  // del Promise.all y sumaba una espera de red entera a cada carga del panel.
  const [reportes, avisosNotasIA, solicitudesImpulso, memoriasImpulso, { data: entrenadoresData }, { count: solicitudesPendientes }] =
    await Promise.all([
      obtenerReportes(supabase, alumnos),
      obtenerAvisosNotasIA(supabase),
      obtenerSolicitudesAsistenciaEnVivo(supabase),
      obtenerResumenMemoriaImpulso(supabase),
      supabase
        .from("perfiles")
        .select("id, nombre")
        .eq("rol", "entrenador")
        .order("nombre", { ascending: true }),
      supabase
        .from("solicitudes_registro")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente"),
    ]);
  const entrenadores = entrenadoresData ?? [];

  // Los que necesitan atención primero: es lo que el entrenador tiene que ver
  // al entrar, sin buscar entre toda la lista.
  const ORDEN: Record<EstadoAlumno, number> = { atencion: 0, normal: 1, destacado: 2 };
  reportes.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);

  const sinRutina = reportes.filter((r) => r.motivo === "Sin rutina activa asignada").length;
  const aRevisar = reportes.filter(
    (r) => r.estado === "atencion" && r.motivo !== "Sin rutina activa asignada"
  ).length;
  const alDia = reportes.filter((r) => r.estado === "normal").length;
  const destacados = reportes.filter((r) => r.estado === "destacado").length;
  const query = await searchParams;
  const filtrosValidos: FiltroAlumnos[] = ["todos", "sin_rutina", "seguimiento", "al_dia", "destacados"];
  const filtroInicial = filtrosValidos.includes(query.estado as FiltroAlumnos)
    ? (query.estado as FiltroAlumnos)
    : "todos";

  return (
    <div className="space-y-6 pb-8">
      <TituloPestana>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vip">Gestión de clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text md:text-3xl">Alumnos</h1>
          <p className="mt-1 text-sm text-text-secondary">Seguimiento, alertas y acciones del equipo en un solo lugar.</p>
        </div>
      </TituloPestana>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Resumen de alumnos">
        <AdminStatCard href="/admin/alumnos?estado=todos#directorio-alumnos" icon={<Users size={20} />} value={reportes.length} label="Alumnos activos" detail="Ver base completa" color="#3b82f6" />
        <AdminStatCard href="/admin/alumnos?estado=sin_rutina#directorio-alumnos" icon={<Dumbbell size={20} />} value={sinRutina} label="Sin rutina" detail="Ver pendientes de planificación" color={sinRutina > 0 ? "#ef4444" : "var(--color-text-tertiary)"} />
        <AdminStatCard href="/admin/alumnos?estado=seguimiento#directorio-alumnos" icon={<AlertTriangle size={20} />} value={aRevisar} label="Por revisar" detail="Ver actividad o registros" color={aRevisar > 0 ? "#f59e0b" : "var(--color-text-tertiary)"} />
        <AdminStatCard href="/admin/alumnos?estado=al_dia#directorio-alumnos" icon={<CircleCheck size={20} />} value={alDia} label="Al día" detail="Ver seguimiento estable" color="#22c55e" />
        <AdminStatCard href="/admin/alumnos?estado=destacados#directorio-alumnos" icon={<Star size={20} />} value={destacados} label="Destacados" detail="Ver buen desempeño" color={destacados > 0 ? "#a78bfa" : "var(--color-text-tertiary)"} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section id="directorio-alumnos" className="admin-panel-card order-2 min-w-0 scroll-mt-28 rounded-3xl p-4 md:p-5 xl:order-1" aria-label="Directorio de alumnos">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-vip" />
                <h2 className="text-base font-semibold text-text">Directorio y seguimiento</h2>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">Busca, filtra y entra a la ficha completa de cualquier alumno.</p>
            </div>
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-text-secondary">
              {reportes.length} perfiles
            </span>
          </div>
          <ListaAlumnos key={filtroInicial} reportes={reportes} sesionUserId={sesion.userId} filtroInicial={filtroInicial} />
        </section>

        <aside className="order-1 space-y-4 xl:order-2 xl:sticky xl:top-28" aria-label="Acciones y avisos">
          <AsistenciaImpulsoEnVivo solicitudes={solicitudesImpulso} />
          <MemoriaImpulsoVIP memorias={memoriasImpulso} />
          <div className="admin-panel-card rounded-3xl p-4">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={17} className="text-vip" />
              <div>
                <h2 className="text-sm font-semibold text-text">Acciones rápidas</h2>
                <p className="text-[11px] text-text-tertiary">Altas y solicitudes pendientes</p>
              </div>
            </div>
            <div className="space-y-3">
              <CrearAlumnoForm />
              <AvisoSolicitudes pendientes={solicitudesPendientes ?? 0} />
            </div>
          </div>

          <SugerenciasHoy reportes={reportes} />
          <AvisosNotasIA avisos={avisosNotasIA} />
        </aside>
      </div>

      <section className="admin-panel-card rounded-3xl p-4 md:p-5" aria-label="Equipo de entrenadores">
        <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
          <UserCog size={18} className="text-vip" />
          <div>
            <h2 className="text-base font-semibold text-text">Equipo de entrenadores</h2>
            <p className="text-xs text-text-tertiary">Accesos y colaboradores autorizados del portal.</p>
          </div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ListaEntrenadores entrenadores={entrenadores} sesionUserId={sesion.userId} />
          <InvitarEntrenadorForm />
        </div>
      </section>
      </div>
  );
}
