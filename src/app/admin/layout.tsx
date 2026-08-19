import Link from "next/link";
import { Bot, Dumbbell, PanelsTopLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombrePublicado } from "@/lib/nombre";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { obtenerNovedades } from "@/lib/novedades";
import { registrarDespliegueActual } from "@/lib/novedades-deploy";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AvisoNuevaActualizacion } from "@/components/admin/AvisoNuevaActualizacion";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZoomPanel } from "@/components/admin/ZoomPanel";
import { AlternarPanelLateral } from "@/components/admin/AlternarPanelLateral";
import { obtenerResumenAlertasGastos } from "@/lib/gastos/data";
import { contarNotificacionesSinLeer } from "@/lib/notificaciones/data";
import { CampanaNotificaciones } from "@/components/admin/CampanaNotificaciones";
import { AlertTriangle } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const esAdmin = sesion.rol === "admin";
  const nombrePanel = esAdmin ? "Panel de administración" : "Panel del entrenador";
  const supabase = await createClient();

  // El registro de la versión debe terminar antes de leer las novedades, pero
  // puede correr en paralelo con el resto de consultas del layout.
  const registroDespliegue = esAdmin ? registrarDespliegueActual() : Promise.resolve();
  const miAlumnoPerfilPromise = supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  const [
    { data: miAlumnoPerfil },
    { count: alimentosPendientes },
    { count: solicitudesPendientes },
    novedades,
    gastosAlerta,
    notificacionesSinLeer,
  ] = await Promise.all([
    miAlumnoPerfilPromise,
    esAdmin ? supabase
      .from("alimentos")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", false)
      .eq("activo", true) : Promise.resolve({ count: 0 }),
    esAdmin ? supabase
      .from("solicitudes_registro")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente") : Promise.resolve({ count: 0 }),
    // Solo las fechas: es lo único que necesita el contador de "sin ver" de
    // la navegación (ver `lib/novedades-vistas-local.ts`), y no vale la pena
    // mandar título/resumen de todas al cliente en cada carga del panel.
    esAdmin ? registroDespliegue.then(() => obtenerNovedades(10)) : Promise.resolve([]),
    esAdmin ? obtenerResumenAlertasGastos() : Promise.resolve({ pendientes: 0, vencidos: 0, proximos: 0 }),
    contarNotificacionesSinLeer(),
  ]);

  const badges = {
    rol: esAdmin ? "admin" as const : "entrenador" as const,
    alimentosPendientes: alimentosPendientes ?? 0,
    solicitudesPendientes: solicitudesPendientes ?? 0,
    novedadesFechas: novedades.map((n) => n.creadoEn),
    gastosPendientes: gastosAlerta.pendientes,
  };

  return (
    <div className="admin-shell fixed inset-0 flex overflow-hidden bg-bg">
      {/* Solo se dibuja cuando la barra está oculta (lo decide el CSS con
          `data-panel-admin`); es la única forma de volver a abrirla. */}
      <AlternarPanelLateral modo="abrir" />

      <aside className="admin-sidebar hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-border px-4 md:flex">
        <div className="shrink-0 border-b border-border pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/portal-v2/mas" className="admin-v2-brand" aria-label="Volver a Portal VIP V2">
              <strong>VIP FITNESS</strong>
              <small>CONTROL V2</small>
            </Link>
            <span className="flex items-center gap-1.5">
              <ZoomPanel />
              <ThemeToggle />
              <AlternarPanelLateral modo="cerrar" />
            </span>
          </div>
          <div className="admin-profile-card mt-4 rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {nombrePanel}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-text">
              {nombrePublicado(sesion.nombre)}
            </p>
          </div>
        </div>

        <AdminTabs variant="sidebar" {...badges} />

        <div className="shrink-0 space-y-2 border-t border-border py-4">
          <Link
            href="/portal-v2/mas"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-vip hover:bg-surface-2"
          >
            <PanelsTopLeft size={16} /> Volver a Portal V2
          </Link>
          {miAlumnoPerfil ? (
            <Link
              href="/portal-v2/entrenamiento"
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-vip hover:bg-surface-2"
            >
              <Dumbbell size={16} /> Ver mi entrenamiento
            </Link>
          ) : (
            <form action={crearMiPerfilAlumno}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:bg-surface-2"
              >
                <Dumbbell size={16} /> Activar mi perfil de alumno
              </button>
            </form>
          )}
          <LogoutButton className="block w-full py-2 text-center text-xs text-text-tertiary hover:text-text" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mismo material que la cabecera del alumno (`panel-aero-superior`):
            placa flotante translúcida con tinte VIP y desenfoque, en vez de la
            franja plana con borde que había acá. Solo cambia el aspecto — el
            contenido y lo que hace cada botón queda igual.
            Ojo: las reglas de Espejo están limitadas a `.shell-alumno`, así que
            el panel del entrenador se queda siempre con el tema VIP aunque el
            alumno elija el modo compacto. */}
        {/* Cabezal de celular (instructivo §6): marca compacta, contexto y
            acciones. Tema, tamaño y cerrar sesión siguen en Más (§4.3) — pero
            "Mi rutina" vuelve acá arriba (pedido de Alejandro, 2026-08-16):
            para quien entrena y entrena, es la acción que más usa apenas
            entra, no algo que valga la pena esconder dos toques más adentro.
            Queda como botón secundario (borde, no relleno) para no competir
            con el dorado de Asistente; sin texto bajo 380px, igual que
            Asistente, para no repetir el amontonamiento original. */}
        <header className="panel-aero-superior imprimir-oculto z-30 flex h-14 shrink-0 items-center gap-2.5 px-3 md:hidden">
          <Link href="/portal-v2/mas" className="admin-v2-brand admin-v2-brand-mobile" aria-label="Volver a Portal VIP V2">
            <strong>VIP FITNESS</strong>
            <small>CONTROL V2</small>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-text-tertiary">
              {nombrePanel}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-text">
              {nombrePublicado(sesion.nombre)}
            </p>
          </div>
          {miAlumnoPerfil && (
            <Link
              href="/portal-v2/entrenamiento"
              aria-label="Ver mi rutina"
              className="radius-control flex h-9 shrink-0 items-center gap-1.5 border border-white/15 px-2.5 text-[11px] font-semibold text-text-secondary"
            >
              <Dumbbell size={15} /> <span className="hidden min-[380px]:inline">Mi rutina</span>
            </Link>
          )}
          <CampanaNotificaciones sinLeer={notificacionesSinLeer} />
          <Link
            href="/admin/asistente"
            aria-label="Abrir Asistente VIP"
            className="btn-accion radius-control flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-[11px] font-semibold"
          >
            <Bot size={15} /> <span className="hidden min-[380px]:inline">Asistente</span>
          </Link>
        </header>

        <main className="pantalla-scroll min-w-0 flex-1 px-4 pb-28 md:px-8 md:pb-10 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">
            {esAdmin && gastosAlerta.pendientes > 0 && (
              <Link href="/admin/gastos" className="mb-4 flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-caption font-semibold text-text">
                <AlertTriangle size={17} className={gastosAlerta.vencidos ? "text-error" : "text-warning"} />
                {gastosAlerta.vencidos > 0
                  ? `${gastosAlerta.vencidos} pago${gastosAlerta.vencidos === 1 ? "" : "s"} vencido${gastosAlerta.vencidos === 1 ? "" : "s"}. Revisar gastos de la app.`
                  : `${gastosAlerta.pendientes} pago${gastosAlerta.pendientes === 1 ? "" : "s"} se acerca${gastosAlerta.pendientes === 1 ? "" : "n"}. Revisar calendario.`}
              </Link>
            )}
            {children}
          </div>
          <LogoutButton className="mt-8 block w-full py-2 text-center text-xs text-text-tertiary md:hidden" />
        </main>
      </div>

      {/* Igual que la barra del alumno: flotante, redondeada y con el mismo
          tinte VIP abajo, en vez de una franja pegada al borde inferior. */}
      <div className="barra-iconos-admin panel-aero-inferior franja-segura-inferior fixed inset-x-0 bottom-0 z-40 md:hidden">
        <AdminTabs {...badges} />
      </div>

      <AvisoNuevaActualizacion novedad={novedades[0] ?? null} />
    </div>
  );
}
