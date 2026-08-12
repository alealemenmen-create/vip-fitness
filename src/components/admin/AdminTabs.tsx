"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  ClipboardList,
  CircleDollarSign,
  Dumbbell,
  FileText,
  History,
  Landmark,
  Megaphone,
  MoreHorizontal,
  Salad,
  Settings,
  Sparkles,
  ShieldCheck,
  Trophy,
  Users,
  WandSparkles,
  PencilRuler,
} from "lucide-react";
import { contarNovedadesSinVer } from "@/lib/novedades-vistas-local";

type AdminTabsProps = {
  alimentosPendientes?: number;
  solicitudesPendientes?: number;
  gastosPendientes?: number;
  /** Fechas (`creado_en`) de las últimas novedades — de acá sale cuántas
   * están sin ver, comparando contra lo último visto en este dispositivo. */
  novedadesFechas?: string[];
  variant?: "mobile" | "sidebar";
};

const MOBILE_TABS = [
  { href: "/admin/alumnos", label: "Alumnos", icon: Users, section: "alumnos" },
  // El armado manual es ahora la herramienta principal del entrenador. Debe
  // quedar a un toque también en celular, no escondido dentro de otro flujo.
  { href: "/admin/armar-rutina", label: "Armar", icon: PencilRuler, section: "armar-rutina" },
  { href: "/admin/documentos", label: "Documentos", icon: FileText, section: "documentos" },
  { href: "/admin/alimentos", label: "Alimentos", icon: Salad, section: "alimentos" },
  { href: "/admin/configuracion", label: "Más", icon: MoreHorizontal, section: "mas" },
] as const;

const SIDEBAR_GROUPS = [
  {
    label: "Trabajo diario",
    items: [
      { href: "/admin/alumnos", label: "Alumnos", icon: Users, section: "alumnos" },
      // Primero la herramienta manual: es la puerta que el entrenador usa a
      // diario. El generador con cuestionario queda debajo, para cuando quiera
      // afinar cada detalle antes de generar.
      { href: "/admin/armar-rutina", label: "Armar rutina", icon: PencilRuler, section: "armar-rutina" },
      { href: "/admin/generador", label: "Generador de rutinas", icon: WandSparkles, section: "generador" },
      { href: "/admin/documentos", label: "Documentos", icon: FileText, section: "documentos" },
      // Reabrir lo ya hecho: con 68 alumnos, la mayoría de las rutinas nuevas
      // son una variación de la anterior de esa misma persona.
      { href: "/admin/rutinas-generadas", label: "Rutinas hechas", icon: History, section: "rutinas-generadas" },
      { href: "/admin/ejercicios", label: "Ejercicios", icon: Dumbbell, section: "ejercicios" },
      { href: "/admin/puntos", label: "Otorgar puntos", icon: Sparkles, section: "puntos" },
    ],
  },
  {
    label: "Seguimiento",
    items: [
      { href: "/admin/asistente", label: "Asistente VIP", icon: Bot, section: "asistente" },
      { href: "/admin/alimentos", label: "Alimentos", icon: Salad, section: "alimentos" },
      { href: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList, section: "solicitudes" },
      { href: "/admin/ingresos", label: "Ingresos", icon: Landmark, section: "ingresos" },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { href: "/admin/torneos", label: "Arena", icon: Trophy, section: "torneos" },
      { href: "/admin/noticias", label: "Noticias", icon: Megaphone, section: "noticias" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/auditoria", label: "Auditoría", icon: ShieldCheck, section: "auditoria" },
      { href: "/admin/novedades", label: "Actualizaciones", icon: Bell, section: "novedades" },
      { href: "/admin/gastos", label: "Gastos de la app", icon: CircleDollarSign, section: "gastos" },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings, section: "configuracion" },
    ],
  },
] as const;

const MORE_PREFIXES = [
  "/admin/configuracion",
  "/admin/puntos",
  "/admin/rutinas-generadas",
  "/admin/ejercicios",
  "/admin/asistente",
  "/admin/ingresos",
  "/admin/auditoria",
  "/admin/torneos",
  "/admin/noticias",
  "/admin/novedades",
  "/admin/gastos",
];

function estaActivo(pathname: string, href: string, section: string) {
  if (section === "alumnos") {
    return pathname.startsWith("/admin/alumnos") || pathname.startsWith("/admin/solicitudes");
  }
  if (section === "mas") return MORE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pendientesDe(
  section: string,
  alimentosPendientes: number,
  solicitudesPendientes: number,
  novedadesSinVer: number,
  gastosPendientes: number,
) {
  if (section === "alimentos") return alimentosPendientes;
  if (section === "alumnos" || section === "solicitudes") return solicitudesPendientes;
  // En el celular, "Actualizaciones" no tiene lugar propio en la barra: se
  // llega por "Más", así que ahí es donde tiene que verse el aviso.
  if (section === "gastos") return gastosPendientes;
  if (section === "novedades") return novedadesSinVer;
  if (section === "mas") return novedadesSinVer + gastosPendientes;
  return 0;
}

export function AdminTabs({
  alimentosPendientes = 0,
  solicitudesPendientes = 0,
  novedadesFechas = [],
  gastosPendientes = 0,
  variant = "mobile",
}: AdminTabsProps) {
  const pathname = usePathname();
  const [novedadesSinVer, setNovedadesSinVer] = useState(0);

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
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-5" aria-label="Panel del entrenador">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = estaActivo(pathname, item.href, item.section);
                const esperando = pendientesDe(item.section, alimentosPendientes, solicitudesPendientes, novedadesSinVer, gastosPendientes);
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
    <nav className="navegacion-aero flex items-stretch gap-1 px-2 pb-[max(4px,env(safe-area-inset-bottom))] pt-2" aria-label="Navegación del entrenador">
      {MOBILE_TABS.map((tab) => {
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
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              {esperando > 0 && (
                <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-bg bg-error" />
              )}
            </span>
            <span className={`truncate text-[10px] ${active ? "font-semibold text-text" : ""}`}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
