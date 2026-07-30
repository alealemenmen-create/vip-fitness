"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FolderOpen, Salad, Trophy, Megaphone, Settings } from "lucide-react";

// Seis pestañas es el máximo que entra cómodo en un celular angosto; si hace
// falta agregar otra, conviene mover alguna al menú en vez de apretarlas más.
const TABS = [
  { href: "/admin/alumnos", label: "Alumnos", icon: Users },
  { href: "/admin/documentos", label: "Docs", icon: FolderOpen },
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
    <div className="flex items-stretch bg-bg px-2 pb-1 pt-4">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors duration-200 ease-in-out ${
              active ? "text-vip" : "text-text-tertiary"
            }`}
          >
            <Icon size={26} strokeWidth={active ? 2.25 : 2} />
            <span className={`text-caption ${active ? "font-semibold" : ""}`}>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
