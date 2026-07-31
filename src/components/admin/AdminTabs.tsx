"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Salad, Trophy, Megaphone, Settings, FileText } from "lucide-react";

// Seis pestañas es el máximo que entra cómodo en un celular angosto; si hace
// falta agregar otra, conviene mover alguna al menú en vez de apretarlas más.
const TABS = [
  { href: "/admin/alumnos", label: "Alumnos", icon: Users },
  { href: "/admin/documentos", label: "Docs", icon: FileText },
  { href: "/admin/alimentos", label: "Alimentos", icon: Salad },
  { href: "/admin/torneos", label: "Torneos", icon: Trophy },
  { href: "/admin/noticias", label: "Noticias", icon: Megaphone },
  { href: "/admin/configuracion", label: "Config.", icon: Settings },
];

/** Barra fija abajo, mismo lenguaje visual que el BottomNav del alumno
 * (íconos grandes arriba del texto, resaltado en ámbar la pestaña activa). */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-stretch gap-1 bg-bg px-2 pb-1 pt-4">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`radius-control flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200 ease-in-out ${
              active ? "bg-surface-2 text-vip" : "text-text-tertiary"
            }`}
          >
            <Icon
              size={24}
              strokeWidth={active ? 2.25 : 1.75}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? 0.16 : 0}
              className={active ? "scale-110 transition-transform duration-200" : ""}
            />
            <span className={`text-caption ${active ? "font-semibold text-text" : ""}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
