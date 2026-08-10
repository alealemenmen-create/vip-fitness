"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, Trophy } from "lucide-react";

// Documentos salió de la barra: vive en el menú de las tres rayitas. Ranked
// entró en su lugar porque es de consulta diaria.
const TABS = [
  { href: "/alumno/inicio", label: "Inicio", icon: Home },
  { href: "/alumno/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/alumno/comer", label: "Nutrición", icon: UtensilsCrossed },
  { href: "/alumno/progreso", label: "Mi avance", icon: TrendingUp },
  { href: "/alumno/ranked", label: "Ranked", icon: Trophy },
];

/**
 * `sesionEnProgresoId`: mientras haya un entrenamiento abierto, la pestaña
 * Entrenar vuelve a ESA sesión y no a la lista de días. Si el alumno se va a
 * Nutrición a anotar algo en medio del entrenamiento, tocar Entrenar lo
 * devuelve donde estaba, sin tener que buscar el día y volver a entrar.
 */
export function BottomNav({ sesionEnProgresoId = null }: { sesionEnProgresoId?: string | null }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="navegacion-aero flex items-stretch gap-1 px-2 pb-1 pt-3">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const href =
          tab.href === "/alumno/entrenar" && sesionEnProgresoId
            ? `/alumno/entrenar/sesion/${sesionEnProgresoId}`
            : tab.href;
        // Con `===` a secas, Nutrición nunca se encendía: su URL real lleva la
        // fecha (`/alumno/comer/2026-07-31`), porque `/alumno/comer` redirige a
        // hoy. Lo mismo valía para la sesión de Entrenar y el historial.
        // Ninguna de las cinco rutas es prefijo de otra, así que comparar por
        // prefijo no puede encender dos a la vez.
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`item-navegacion-aero radius-card flex flex-1 flex-col items-center gap-1 py-2.5 transition-all duration-200 ease-in-out ${
              active ? "item-navegacion-aero-activo text-vip" : "text-text-tertiary"
            }`}
          >
            <Icon
              size={26}
              strokeWidth={active ? 2.25 : 1.75}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? 0.16 : 0}
              className={`icono-navegacion-aero ${active ? "scale-110 transition-transform duration-200" : ""}`}
            />
            <span className={`text-caption ${active ? "font-semibold text-text" : ""}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
