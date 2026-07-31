"use client";

import { Flame, Beef, Droplet, Wheat } from "lucide-react";

type Macro = {
  clave: string;
  etiqueta: string;
  Icono: typeof Flame;
  /** Token del tema, nunca un color literal: los define globals.css a partir
   * del acento activo, así VIP / Lady / Espejo se aplican solos. */
  color: string;
  consumido: number;
  objetivo: number | null;
};

/**
 * Calorías y macros del día, en el formato "consumido / objetivo".
 *
 * La barra se anima con `transform: scaleX()` y no con `width`: el ancho
 * obliga al navegador a recalcular layout en cada cuadro, la transformación
 * no. Como el componente conserva su identidad entre renders, la transición
 * arranca sola desde el valor anterior — no vuelve a cero al agregar comida.
 */
export function TarjetaMacros({
  kcal,
  kcalObjetivo,
  prot,
  protObjetivo,
  grasa,
  grasaObjetivo,
  carb,
  carbObjetivo,
}: {
  kcal: number;
  kcalObjetivo: number | null;
  prot: number;
  protObjetivo: number | null;
  grasa: number;
  grasaObjetivo: number | null;
  carb: number;
  carbObjetivo: number | null;
}) {
  const macros: Macro[] = [
    {
      clave: "cal",
      etiqueta: "CAL",
      Icono: Flame,
      color: "var(--macro-cal)",
      consumido: kcal,
      objetivo: kcalObjetivo,
    },
    {
      clave: "prot",
      etiqueta: "PROT",
      Icono: Beef,
      color: "var(--macro-prot)",
      consumido: prot,
      objetivo: protObjetivo,
    },
    {
      clave: "grasa",
      etiqueta: "GRASAS",
      Icono: Droplet,
      color: "var(--macro-grasa)",
      consumido: grasa,
      objetivo: grasaObjetivo,
    },
    {
      clave: "carb",
      etiqueta: "CARB",
      Icono: Wheat,
      color: "var(--macro-carb)",
      consumido: carb,
      objetivo: carbObjetivo,
    },
  ];

  return (
    <div className="radius-card grid grid-cols-4 gap-3 border border-border bg-surface p-4">
      {macros.map((m) => {
        const consumido = Math.round(m.consumido);
        // Pasarse no rompe la barra: se llena al 100% y el número real queda
        // a la vista, que es el dato que importa.
        const avance = m.objetivo && m.objetivo > 0 ? Math.min(1, m.consumido / m.objetivo) : 0;
        return (
          <div key={m.clave} className="min-w-0">
            <div className="flex items-baseline gap-1">
              <m.Icono size={11} style={{ color: m.color }} className="shrink-0 self-center" />
              <span className="text-secondary font-semibold" style={{ color: m.color }}>
                {consumido}
              </span>
              {m.objetivo !== null && (
                <span className="text-[11px] text-text-tertiary">/{Math.round(m.objetivo)}</span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] font-medium tracking-wide text-text-tertiary">
              {m.etiqueta}
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${avance})`, background: m.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
