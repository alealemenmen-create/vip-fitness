import Link from "next/link";
import { Command } from "lucide-react";
import { requireControlVipV2 } from "@/lib/auth";
import { nombrePublicado } from "@/lib/nombre";
import { ControlVipV2Tabs } from "@/components/control-vip-v2/ControlVipV2Tabs";
import { ComandoGlobalControlVipV2 } from "@/components/control-vip-v2/ComandoGlobalControlVipV2";
import { LogoutButton } from "@/components/LogoutButton";
import { obtenerColaPendientes } from "@/lib/pendientes/data";
import { obtenerListaAlumnosBasica } from "@/app/admin/alumnos/rutinaTexto";

/**
 * Shell de "Control VIP V2" (docs/PROYECTO_CONTROL_VIP_V2.md, Fase 1).
 * Misma estructura responsive que `src/app/admin/layout.tsx` (sidebar fija
 * en escritorio, barra inferior en celular), con el scope `.control-vip-shell`
 * en vez de `.admin-shell` — así puede evolucionar su look sin tocar una
 * sola pantalla del panel actual. No incluye (todavía) el botón para
 * ocultar la barra lateral ni el widget de "mi rutina": el objetivo de esta
 * fase es el shell mínimo funcionando, no paridad total con `/admin`.
 */
export default async function ControlVipV2Layout({ children }: { children: React.ReactNode }) {
  const sesion = await requireControlVipV2();
  const esAdmin = sesion.rol === "admin";
  const nombrePanel = esAdmin ? "Control VIP V2 · Administración" : "Control VIP V2 · Entrenador";

  const [colaPendientes, alumnos] = await Promise.all([
    obtenerColaPendientes(),
    obtenerListaAlumnosBasica(),
  ]);
  const pendientesHoy = colaPendientes.reduce((total, c) => total + c.cantidad, 0);

  return (
    <div className="control-vip-shell fixed inset-0 flex overflow-hidden bg-bg">
      <aside className="admin-sidebar hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-border px-4 md:flex">
        <div className="shrink-0 border-b border-border pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/control-vip" className="admin-v2-brand" aria-label="Ir a Hoy">
              <strong>VIP FITNESS</strong>
              <small>CONTROL VIP V2</small>
            </Link>
          </div>
          <div className="admin-profile-card mt-4 rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{nombrePanel}</p>
            <p className="mt-1 truncate text-sm font-semibold text-text">{nombrePublicado(sesion.nombre)}</p>
          </div>
        </div>

        <ControlVipV2Tabs variant="sidebar" rol={esAdmin ? "admin" : "entrenador"} pendientesHoy={pendientesHoy} />

        <div className="shrink-0 space-y-2 border-t border-border py-4">
          <p className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-text-tertiary">
            <Command size={13} /> Ctrl/Cmd + K para buscar
          </p>
          <Link
            href="/admin/alumnos"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-vip hover:bg-surface-2"
          >
            Volver al panel actual
          </Link>
          <LogoutButton className="block w-full py-2 text-center text-xs text-text-tertiary hover:text-text" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="panel-aero-superior imprimir-oculto z-30 flex h-14 shrink-0 items-center gap-2.5 px-3 md:hidden">
          <Link href="/control-vip" className="admin-v2-brand admin-v2-brand-mobile" aria-label="Ir a Hoy">
            <strong>VIP FITNESS</strong>
            <small>CONTROL V2</small>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-text-tertiary">{nombrePanel}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-text">{nombrePublicado(sesion.nombre)}</p>
          </div>
        </header>

        <main className="pantalla-scroll min-w-0 flex-1 px-4 pb-28 md:px-8 md:pb-10 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <div className="barra-iconos-admin panel-aero-inferior franja-segura-inferior fixed inset-x-0 bottom-0 z-40 md:hidden">
        <ControlVipV2Tabs rol={esAdmin ? "admin" : "entrenador"} pendientesHoy={pendientesHoy} />
      </div>

      <ComandoGlobalControlVipV2 alumnos={alumnos} />
    </div>
  );
}
