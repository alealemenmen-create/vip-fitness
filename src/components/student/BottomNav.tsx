"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, Trophy } from "lucide-react";

// Documentos salió de la barra: vive en el menú de las tres rayitas. Ranked
// entró en su lugar porque es de consulta diaria.
const TABS = [
  { href: "/alumno/inicio", label: "Inicio", icon: Home },
  { href: "/alumno/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/alumno/comer", label: "Comer", icon: UtensilsCrossed },
  { href: "/alumno/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/alumno/ranked", label: "Ranked", icon: Trophy },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-stretch bg-bg px-2 pb-1 pt-4">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href;
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
