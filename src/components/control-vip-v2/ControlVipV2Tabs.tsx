"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  gruposControlVipV2ParaRol,
  MOBILE_TABS_CONTROL_VIP_V2,
} from "@/lib/control-vip-v2/destinos";

type ControlVipV2TabsProps = {
  rol: "entrenador" | "admin";
  /** Total de "Necesita tu decisión" — se muestra en la pestaña Hoy. */
  pendientesHoy?: number;
  variant?: "mobile" | "sidebar";
};

/** Hoy no tiene subrutas en esta fase: activo solo con match exacto, para no
 * encenderse también cuando el pathname es `/control-vip/mas`. El resto sí
 * acepta subrutas (match por prefijo) para cuando tengan pantallas propias. */
function activo(pathname: string, href: string) {
  if (href === "/control-vip") return pathname === "/control-vip";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ControlVipV2Tabs({ rol, pendientesHoy = 0, variant = "mobile" }: ControlVipV2TabsProps) {
  const pathname = usePathname();
  const etiquetaPanel = rol === "admin" ? "Control VIP V2 · Administración" : "Control VIP V2 · Entrenador";

  if (variant === "sidebar") {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-5" aria-label={etiquetaPanel}>
        {gruposControlVipV2ParaRol(rol).map((grupo) => (
          <div key={grupo.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {grupo.label}
            </p>
            <div className="space-y-1">
              {grupo.items.map((item) => {
                const Icon = item.icon;
                const active = activo(pathname, item.href);
                const esperando = item.seccion === "hoy" ? pendientesHoy : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-sidebar-link flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      active
                        ? "admin-sidebar-link-active border-vip/25 font-semibold text-vip"
                        : "border-transparent text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text"
                    }`}
                  >
                    <Icon size={19} strokeWidth={active ? 2.25 : 1.8} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {esperando > 0 && (
                      <span className="min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                        {esperando > 99 ? "99+" : esperando}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="navegacion-aero flex items-stretch gap-1 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-2" aria-label={`Navegación · ${etiquetaPanel}`}>
      {MOBILE_TABS_CONTROL_VIP_V2.map((tab) => {
        const Icon = tab.icon;
        const active = activo(pathname, tab.href);
        const esperando = tab.seccion === "hoy" ? pendientesHoy : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={esperando > 0 ? `${tab.label}: ${esperando} pendientes` : tab.label}
            className={`item-navegacion-aero radius-control flex min-w-0 flex-1 flex-col items-center gap-1 py-2 transition-colors ${
              active ? "item-navegacion-aero-activo text-vip" : "text-text-tertiary"
            }`}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              {esperando > 0 && (
                <span className="insignia-nav-panel" aria-hidden>
                  {esperando > 99 ? "99+" : esperando}
                </span>
              )}
            </span>
            <span className={`truncate text-[10px] ${active ? "font-semibold text-text" : ""}`}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
