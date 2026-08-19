import Link from "next/link";
import { Activity, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { CrearAlumnoForm } from "@/components/admin/CrearAlumnoForm";
import { InvitarEntrenadorForm } from "@/components/admin/InvitarEntrenadorForm";
import { ListaAlumnos, type FiltroAlumnos } from "@/components/admin/ListaAlumnos";
import { ListaEntrenadores } from "@/components/admin/ListaEntrenadores";
import { AvisosNotasIA } from "@/components/admin/AvisosNotasIA";
import { AvisoSolicitudes } from "@/components/admin/AvisoSolicitudes";
import { SugerenciasHoy } from "@/components/admin/SugerenciasHoy";
import { GavetaConfig } from "@/components/admin/GavetaConfig";
import { obtenerReportes, obtenerAvisosNotasIA, type EstadoAlumno, type PrioridadAlumno } from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AsistenciaImpulsoEnVivo } from "@/components/admin/AsistenciaImpulsoEnVivo";
import { obtenerSolicitudesAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import { obtenerResumenMemoriaImpulso } from "@/lib/impulso-vip/memoria-data";
import { MemoriaImpulsoVIP } from "@/components/admin/MemoriaImpulsoVIP";
import { obtenerPropuestasImpulso } from "@/lib/impulso-vip/propuestas-data";
import { PropuestasImpulsoVIP } from "@/components/admin/PropuestasImpulsoVIP";
import { obtenerHistorialImpulsoReciente } from "@/lib/impulso-vip/historial-data";
import { HistorialImpulsoVIP } from "@/components/admin/HistorialImpulsoVIP";
import { obtenerIngresos } from "@/lib/ingresos/data";
import { AlumnosSinIngresar } from "@/components/admin/AlumnosSinIngresar";

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; propuesta?: string }>;
}) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const esAdmin = sesion.rol === "admin";
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
  const [reportes, avisosNotasIA, solicitudesImpulso, memoriasImpulso, propuestasImpulso, historialImpulso, { resumen: resumenIngresos }, { data: entrenadoresData }, { count: solicitudesPendientes }] =
    await Promise.all([
      obtenerReportes(supabase, alumnos),
      obtenerAvisosNotasIA(supabase),
      obtenerSolicitudesAsistenciaEnVivo(supabase),
      obtenerResumenMemoriaImpulso(supabase),
      obtenerPropuestasImpulso(supabase),
      obtenerHistorialImpulsoReciente(supabase),
      obtenerIngresos("semana"),
      esAdmin ? supabase
        .from("perfiles")
        .select("id, nombre")
        .eq("rol", "entrenador")
        .order("nombre", { ascending: true }) : Promise.resolve({ data: [] }),
      esAdmin ? supabase
        .from("solicitudes_registro")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente") : Promise.resolve({ count: 0 }),
    ]);
  const entrenadores = entrenadoresData ?? [];

  // Los que necesitan atención primero: es lo que el entrenador tiene que ver
  // al entrar, sin buscar entre toda la lista. La prioridad manda (Ahora >
  // Hoy > Esta semana > Sin acción); a igual prioridad, el semáforo viejo
  // desempata entre destacado y normal.
  const ORDEN_PRIORIDAD: Record<PrioridadAlumno, number> = { ahora: 0, hoy: 1, esta_semana: 2, sin_accion: 3 };
  const ORDEN: Record<EstadoAlumno, number> = { atencion: 0, normal: 1, destacado: 2 };
  reportes.sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || ORDEN[a.estado] - ORDEN[b.estado]);

  // Los cinco conteos que se calculaban acá (sinRutina, aRevisar, alDia,
  // destacados) alimentaban las tarjetas de resumen que se eliminaron.
  // `ListaAlumnos` los recalcula por su cuenta para su propia banda de
  // filtros, así que repetirlos en el servidor era trabajo sin destino.
  const query = await searchParams;
  const filtrosValidos: FiltroAlumnos[] = ["todos", "sin_rutina", "seguimiento", "al_dia", "destacados"];
  const filtroInicial = filtrosValidos.includes(query.estado as FiltroAlumnos)
    ? (query.estado as FiltroAlumnos)
    : "todos";

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Prioridad diaria"
        title="Alumnos"
        description="Primero lo que requiere decisión; después, el directorio completo."
        actions={esAdmin ?
          <Link href="/admin/solicitudes" className="boton-panel-secundario">
            Solicitudes{solicitudesPendientes ? ` · ${solicitudesPendientes}` : ""}
          </Link>
        : undefined}
      />

      {/* Las cinco tarjetas grandes de colores que iban acá se eliminaron
          (instructivo §7.2): ocupaban la primera pantalla entera, cada una
          traía su propio color y brillo — así que ninguna priorizaba, "Al día"
          gritaba igual que "Sin rutina" — y sobre todo eran un DUPLICADO: la
          misma banda de cinco filtros con los mismos conteos ya vive dentro
          del directorio, en `ListaAlumnos`, y filtra en el acto en vez de
          recargar la página. Se conservó esa, con el acabado del panel. */}

      {/* `order-1` y no `order-2`: en celular el directorio tiene que ser lo
          primero después de los filtros. Con el orden anterior, Propuestas de
          Impulso, Acciones rápidas y los avisos se metían ANTES y había que
          desplazarse por todo eso para llegar a buscar un alumno, que es a lo
          que el entrenador entra (instructivo §7.1). En escritorio la columna
          lateral sigue a la derecha, igual que siempre. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section id="directorio-alumnos" className="admin-panel-card order-1 min-w-0 scroll-mt-28 rounded-3xl p-4 md:p-5" aria-label="Directorio de alumnos">
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

        <aside className="order-2 space-y-4 xl:sticky xl:top-28" aria-label="Acciones y avisos">
          <AsistenciaImpulsoEnVivo solicitudes={solicitudesImpulso} />
          <PropuestasImpulsoVIP iniciales={propuestasImpulso} destacadaId={query.propuesta} />
          <HistorialImpulsoVIP historial={historialImpulso} />
          <MemoriaImpulsoVIP memorias={memoriasImpulso} />
          {esAdmin ? <div className="admin-panel-card rounded-3xl p-4">
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
          </div> : null}

          <SugerenciasHoy reportes={reportes} />
          <AlumnosSinIngresar resumen={resumenIngresos} />
          <AvisosNotasIA avisos={avisosNotasIA} />
        </aside>
      </div>

      {/* Plegada, no una sección abierta a página completa (rescatado de
          `agent/reorganizar-panel-admin`): gestionar el EQUIPO no es la tarea
          de esta pantalla -es Alumnos- así que no necesita ocupar espacio
          propio debajo del directorio salvo que el entrenador la abra. */}
      {esAdmin ? <GavetaConfig titulo="Equipo de entrenadores" subtitulo={`${entrenadores.length} con acceso al portal`}>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ListaEntrenadores entrenadores={entrenadores} sesionUserId={sesion.userId} />
          <InvitarEntrenadorForm />
        </div>
      </GavetaConfig> : null}
      </div>
  );
}
