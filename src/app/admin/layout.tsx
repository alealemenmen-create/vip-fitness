import Link from "next/link";
import { Bot, Dumbbell } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombrePublicado } from "@/lib/nombre";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { obtenerNovedades } from "@/lib/novedades";
import { registrarDespliegueActual } from "@/lib/novedades-deploy";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AvisoNuevaActualizacion } from "@/components/admin/AvisoNuevaActualizacion";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZoomPanel } from "@/components/admin/ZoomPanel";
import { AlternarPanelLateral } from "@/components/admin/AlternarPanelLateral";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  // El registro de la versión debe terminar antes de leer las novedades, pero
  // puede correr en paralelo con el resto de consultas del layout.
  const registroDespliegue = registrarDespliegueActual();
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
  ] = await Promise.all([
    miAlumnoPerfilPromise,
    supabase
      .from("alimentos")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", false)
      .eq("activo", true),
    supabase
      .from("solicitudes_registro")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
    // Solo las fechas: es lo único que necesita el contador de "sin ver" de
    // la navegación (ver `lib/novedades-vistas-local.ts`), y no vale la pena
    // mandar título/resumen de todas al cliente en cada carga del panel.
    registroDespliegue.then(() => obtenerNovedades(10)),
  ]);

  const badges = {
    alimentosPendientes: alimentosPendientes ?? 0,
    solicitudesPendientes: solicitudesPendientes ?? 0,
    novedadesFechas: novedades.map((n) => n.creadoEn),
  };

  return (
    <div className="admin-shell fixed inset-0 flex overflow-hidden bg-bg">
      {/* Solo se dibuja cuando la barra está oculta (lo decide el CSS con
          `data-panel-admin`); es la única forma de volver a abrirla. */}
      <AlternarPanelLateral modo="abrir" />

      <aside className="admin-sidebar hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-border px-4 md:flex">
        <div className="shrink-0 border-b border-border pb-4 pt-5">
          <Logo
            compact
            height={34}
            corner={
              <span className="flex items-center gap-1.5">
                <ZoomPanel />
                <ThemeToggle />
                <AlternarPanelLateral modo="cerrar" />
              </span>
            }
          />
          <div className="admin-profile-card mt-4 rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              Panel del entrenador
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-text">
              {nombrePublicado(sesion.nombre)}
            </p>
          </div>
        </div>

        <AdminTabs variant="sidebar" {...badges} />

        <div className="shrink-0 space-y-2 border-t border-border py-4">
          {miAlumnoPerfil ? (
            <Link
              href="/alumno/inicio"
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
        <header className="panel-aero-superior imprimir-oculto z-30 flex h-14 shrink-0 items-center gap-2 px-3 md:hidden">
          <Logo compact height={20} className="!w-[118px] !rounded-lg !px-2 !py-1 min-[520px]:!w-[138px]" />
          <div className="hidden min-w-0 flex-1 min-[470px]:block">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-text-tertiary">Entrenador</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-text">{nombrePublicado(sesion.nombre)}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* Achicar la pantalla: es en el celular donde el entrenador
                  pelea por el espacio, así que va acá y no en la barra lateral
                  de escritorio. */}
              <ZoomPanel className="!h-8" />
              <ThemeToggle className="!h-8 !w-8" />
              {miAlumnoPerfil ? (
                <Link
                  href="/alumno/inicio"
                  aria-label="Ver mi entrenamiento"
                  className="radius-control flex h-8 items-center gap-1.5 border border-border bg-surface px-2 text-[11px] font-medium text-vip"
                >
                  <Dumbbell size={14} /> <span className="hidden min-[520px]:inline">Mi rutina</span>
                </Link>
              ) : (
                <form action={crearMiPerfilAlumno}>
                  <button
                    type="submit"
                    aria-label="Activar mi perfil de alumno"
                    className="radius-control flex h-8 items-center gap-1.5 border border-dashed border-border bg-surface px-2 text-[11px] text-text-secondary"
                  >
                    <Dumbbell size={14} /> <span className="hidden min-[520px]:inline">Activar</span>
                  </button>
                </form>
              )}
              <Link
                href="/admin/asistente"
                aria-label="Abrir Asistente VIP"
                className="btn-accion radius-control flex h-8 items-center gap-1.5 px-2 text-[11px] font-semibold"
              >
                <Bot size={14} /> <span className="hidden min-[520px]:inline">Asistente</span>
              </Link>
          </div>
        </header>

        <main className="pantalla-scroll min-w-0 flex-1 px-4 pb-28 md:px-8 md:pb-10 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
          <LogoutButton className="mt-8 block w-full py-2 text-center text-xs text-text-tertiary md:hidden" />
        </main>
      </div>

      {/* Igual que la barra del alumno: flotante, redondeada y con el mismo
          tinte VIP abajo, en vez de una franja pegada al borde inferior. */}
      <div className="panel-aero-inferior franja-segura-inferior fixed inset-x-0 bottom-0 z-40 md:hidden">
        <AdminTabs {...badges} />
      </div>

      <AvisoNuevaActualizacion novedad={novedades[0] ?? null} />
    </div>
  );
}
