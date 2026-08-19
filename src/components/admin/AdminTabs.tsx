"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Dumbbell, MoreHorizontal, Users, PencilRuler } from "lucide-react";
import { contarNovedadesSinVer } from "@/lib/novedades-vistas-local";
import { gruposDestinosParaRol } from "@/lib/admin/destinos";

type AdminTabsProps = {
  rol: "entrenador" | "admin";
  alimentosPendientes?: number;
  solicitudesPendientes?: number;
  gastosPendientes?: number;
  /** Fechas (`creado_en`) de las últimas novedades — de acá sale cuántas
   * están sin ver, comparando contra lo último visto en este dispositivo. */
  novedadesFechas?: string[];
  variant?: "mobile" | "sidebar";
};

/**
 * Los cinco destinos de celular (instructivo §4.1). La barra ofrece VELOCIDAD;
 * la completitud vive en Más, que ahora lista todo el panel.
 *
 * Qué cambió y por qué: "Documentos" y "Alimentos" tenían un lugar propio
 * mientras Galería y Pendientes no existían en el celular, y "Más" iba a
 * Configuración, que solo mostraba diez accesos. Documentos pasa a ser una de
 * las cuatro puertas de Rutinas y Alimentos vive en Bibliotecas, ambos
 * alcanzables desde Más y desde la barra lateral.
 */
const MOBILE_TABS = [
  { href: "/admin/alumnos", label: "Alumnos", icon: Users, section: "alumnos" },
  { href: "/admin/rutinas", label: "Rutinas", icon: PencilRuler, section: "rutinas" },
  { href: "/admin/ejercicios", label: "Galería", icon: Dumbbell, section: "ejercicios" },
  { href: "/admin/pendientes", label: "Pendientes", icon: ClipboardCheck, section: "pendientes" },
  { href: "/admin/mas", label: "Más", icon: MoreHorizontal, section: "mas" },
] as const;

/** Las rutas que enciende cada pestaña además de la suya. */
const RUTAS_POR_SECCION: Record<string, string[]> = {
  alumnos: ["/admin/alumnos", "/admin/solicitudes", "/admin/ingresos"],
  rutinas: [
    "/admin/rutinas",
    "/admin/armar-rutina",
    "/admin/generador",
    "/admin/generador-v2",
    "/admin/rutinas-generadas",
    "/admin/documentos",
  ],
  ejercicios: ["/admin/ejercicios"],
  pendientes: ["/admin/pendientes", "/admin/reportes", "/admin/borrados", "/admin/auditoria"],
};

/** Las rutas que ya tienen pestaña propia abajo. Todo lo demás lo cubre Más. */
const RUTAS_CON_PESTANA = Object.values(RUTAS_POR_SECCION).flat();

function coincide(pathname: string, ruta: string) {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

export function estaActivo(pathname: string, href: string, section: string) {
  // "Más" se enciende por descarte: cualquier ruta del panel que no pertenezca
  // a las otras cuatro pestañas se llega desde ahí. Antes esto era una lista
  // fija de prefijos que había que acordarse de actualizar con cada ruta nueva
  // — y que ya se había quedado corta.
  if (section === "mas") {
    return (
      coincide(pathname, "/admin/mas") ||
      (pathname.startsWith("/admin") && !RUTAS_CON_PESTANA.some((ruta) => coincide(pathname, ruta)))
    );
  }
  const rutas = RUTAS_POR_SECCION[section];
  if (rutas) return rutas.some((ruta) => coincide(pathname, ruta));
  return coincide(pathname, href);
}

export function pendientesDe(
  section: string,
  alimentosPendientes: number,
  solicitudesPendientes: number,
  novedadesSinVer: number,
  gastosPendientes: number,
) {
  if (section === "alimentos") return alimentosPendientes;
  if (section === "alumnos" || section === "solicitudes") return solicitudesPendientes;
  if (section === "gastos") return gastosPendientes;
  if (section === "novedades") return novedadesSinVer;
  // Gastos vencidos y actualizaciones sin ver no tienen pestaña propia en el
  // celular: se llega por Más, así que el aviso tiene que verse ahí.
  if (section === "mas") return novedadesSinVer + gastosPendientes;
  return 0;
}

export function AdminTabs({
  rol,
  alimentosPendientes = 0,
  solicitudesPendientes = 0,
  novedadesFechas = [],
  gastosPendientes = 0,
  variant = "mobile",
}: AdminTabsProps) {
  const pathname = usePathname();
  const [novedadesSinVer, setNovedadesSinVer] = useState(0);
  const etiquetaPanel = rol === "admin" ? "Panel de administración" : "Panel del entrenador";
  const tabsVisibles = rol === "admin"
    ? MOBILE_TABS
    : MOBILE_TABS.filter((tab) => tab.href !== "/admin/ejercicios");

  // Diferido un tick: `localStorage` no existe en el servidor y el primer
  // render tiene que salir igual en servidor y cliente para no desajustar la
  // hidratación (mismo patrón que ZoomPanel/ThemeToggle).
  useEffect(() => {
    const id = window.setTimeout(() => {
      setNovedadesSinVer(contarNovedadesSinVer(novedadesFechas));
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novedadesFechas.join(",")]);

  if (variant === "sidebar") {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-5" aria-label={etiquetaPanel}>
        {gruposDestinosParaRol(rol).map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                // Por `href` y no por sección: dentro de "Rutinas" las cuatro
                // puertas comparten sección, y con la sección se encenderían
                // las cuatro filas a la vez.
                const active = coincide(pathname, item.href);
                const esperando = pendientesDe(item.seccion, alimentosPendientes, solicitudesPendientes, novedadesSinVer, gastosPendientes);
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
    // `navegacion-aero` (transparente) y no `bg-bg/95`: ese fondo casi opaco
    // tapaba el cristal de la placa flotante que lo envuelve, así que la barra
    // de abajo se veía negra mientras la de arriba mostraba el verde y el azul.
    // El borde y el desenfoque los pone la placa; acá sobraban.
    <nav className="navegacion-aero flex items-stretch gap-1 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-2" aria-label={`Navegación · ${etiquetaPanel}`}>
      {tabsVisibles.map((tab) => {
        const Icon = tab.icon;
        const active = estaActivo(pathname, tab.href, tab.section);
        const esperando = pendientesDe(tab.section, alimentosPendientes, solicitudesPendientes, novedadesSinVer, gastosPendientes);
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
              {/* Insignia con el número, no un punto rojo: con cinco destinos
                  el entrenador necesita saber CUÁNTO le espera antes de tocar
                  (maqueta `panel-entrenador-organizado.html`). */}
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
