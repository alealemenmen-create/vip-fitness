"use client";

import { Beef, Droplet, Leaf } from "lucide-react";

type Macro = {
  clave: string;
  etiqueta: string;
  Icono: typeof Beef;
  /** Token del tema, nunca un color literal: los define globals.css a partir
   * del acento activo, así VIP / Lady / Espejo se aplican solos. */
  color: string;
  consumido: number;
  objetivo: number | null;
};

/** Radio y grosor del anillo, en las mismas unidades del viewBox. */
const RADIO = 42;
const GROSOR = 9;
const VUELTA = 2 * Math.PI * RADIO;

/**
 * Lado del anillo, en píxeles.
 *
 * Va como estilo en línea y NO como clase de Tailwind: un `<svg>` con
 * `width/height: 100%` dentro de un contenedor sin medida se dibuja a su
 * tamaño por defecto, que es enorme, y se come el ancho de las barras. Si por
 * lo que sea la clase no llega (CSS a medio cargar, caché vieja), el estilo en
 * línea igual está — y en el celular pasó justamente eso.
 */
const LADO_ANILLO = 76;

/** Anillo de calorías: el trazo se recorta con `strokeDasharray` y arranca
 * arriba (de ahí el giro de -90°). */
function AnilloCalorias({
  kcal,
  objetivo,
  avance,
}: {
  kcal: number;
  objetivo: number | null;
  avance: number;
}) {
  return (
    // 88 px: un cuarto menos que el original. En un teléfono de 360 px el
    // anillo grande no dejaba ancho para las barras y "Carbohidratos" quedaba
    // pegado a su número.
    <div
      className="relative shrink-0"
      style={{ height: LADO_ANILLO, width: LADO_ANILLO }}
    >
      <svg
        viewBox="0 0 100 100"
        width={LADO_ANILLO}
        height={LADO_ANILLO}
        className="-rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={RADIO}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={GROSOR}
        />
        <circle
          cx="50"
          cy="50"
          r={RADIO}
          fill="none"
          // Un poco más claro que el acento base: sobre el gris oscuro de la
          // tarjeta el tono plano se sentía apagado. Mezclado con blanco llama
          // más la atención sin dejar de ser el color del tema.
          stroke="color-mix(in srgb, var(--macro-cal) 82%, white)"
          strokeWidth={GROSOR}
          strokeLinecap="round"
          strokeDasharray={VUELTA}
          strokeDashoffset={VUELTA * (1 - avance)}
          className="drop-shadow-[0_0_6px_var(--macro-cal)] transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>

      {/* `leading-none` en las tres líneas y sin interlineado de más: con la
          altura de línea por defecto el bloque de tres renglones sumaba varios
          píxeles de aire abajo y el número quedaba ópticamente por debajo del
          centro del anillo, aunque el contenedor sí estuviera centrado. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <span className="text-[16px] font-bold leading-none tabular-nums text-text">
          {Math.round(kcal)}
        </span>
        {objetivo !== null && (
          <span className="text-[8px] leading-none tabular-nums text-text-tertiary">
            / {Math.round(objetivo)}
          </span>
        )}
        <span className="text-[8px] font-medium leading-none" style={{ color: "var(--macro-cal)" }}>
          kcal
        </span>
      </div>
    </div>
  );
}

/**
 * Calorías y macros del día: las calorías en un anillo grande y los tres
 * macros en barras al lado, cada uno con su ícono.
 *
 * Las barras se animan con `transform: scaleX()` y no con `width`: el ancho
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
      clave: "prot",
      etiqueta: "Proteínas",
      Icono: Beef,
      color: "var(--macro-prot)",
      consumido: prot,
      objetivo: protObjetivo,
    },
    {
      clave: "grasa",
      etiqueta: "Grasas",
      Icono: Droplet,
      color: "var(--macro-grasa)",
      consumido: grasa,
      objetivo: grasaObjetivo,
    },
    {
      clave: "carb",
      etiqueta: "Carbohidratos",
      Icono: Leaf,
      color: "var(--macro-carb)",
      consumido: carb,
      objetivo: carbObjetivo,
    },
  ];

  // Pasarse no rompe la barra: se llena al 100% y el número real queda a la
  // vista, que es el dato que importa.
  const avance = (valor: number, objetivo: number | null) =>
    objetivo && objetivo > 0 ? Math.min(1, valor / objetivo) : 0;

  return (
    // Borde blanco translúcido, no `border-border` (varía de fuerza entre
    // temas): mismo lenguaje que la banda de días y el buscador de acá
    // abajo, para que las tres piezas se lean como un solo instrumento.
    <div className="radius-card border border-white/[0.07] bg-surface px-3 py-1">
      <p
        className="text-micro text-center font-semibold tracking-wide"
        style={{ color: "var(--macro-cal)" }}
      >
        TU PROGRESO NUTRICIONAL
      </p>

      {/* `-mt-2`: el título de arriba empuja esta fila hacia abajo, y con
          `items-center` a secas el anillo terminaba mucho más cerca del borde
          de abajo de la tarjeta que del de arriba. El corrimiento negativo
          compensa ese empuje para que el margen quede parejo — ver la medición
          en la revisión del cambio. */}
      <div className="-mt-3 flex items-center gap-3">
        <AnilloCalorias
          kcal={kcal}
          objetivo={kcalObjetivo}
          avance={avance(kcal, kcalObjetivo)}
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          {macros.map((m) => (
            <div key={m.clave} className="min-w-0">
              {/* `gap-2` entre el nombre y el número: sin separación mínima, en
                  pantallas angostas "Carbohidratos" terminaba pegado a su
                  cifra. El nombre se recorta antes que el número, que es el
                  dato que importa. */}
              <div className="flex items-center gap-1.5">
                <m.Icono size={11} style={{ color: m.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[10px] leading-none text-text">
                  {m.etiqueta}
                </span>
                <span className="ml-1 shrink-0 whitespace-nowrap text-[10px] leading-none tabular-nums">
                  <span className="font-semibold text-text">{Math.round(m.consumido)}</span>
                  {m.objetivo !== null && (
                    <span className="text-text-tertiary"> / {Math.round(m.objetivo)} g</span>
                  )}
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full w-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{
                    transform: `scaleX(${avance(m.consumido, m.objetivo)})`,
                    background: m.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
