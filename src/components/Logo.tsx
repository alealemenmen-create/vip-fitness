"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Pantallas que cambian la placa de ancho completo por un encabezado bajito:
 * el cuadrito de la marca (la V, el rayo y la P) a la izquierda y el nombre de
 * la sección al lado. La placa entera se comía la parte de arriba en pantallas
 * que necesitan el alto para su propio contenido.
 *
 * El título es opcional y acepta JSX: "Entrenamiento VIP" lleva el VIP en el
 * color de acento, igual que antes cuando era un <h1> aparte.
 */
const RUTAS_COMPACTAS: [ruta: string, titulo?: ReactNode][] = [
  ["/alumno/comer", "Nutrición"],
  [
    "/alumno/entrenar",
    <>
      Entrenamiento <span className="text-vip">VIP</span>
    </>,
  ],
  ["/alumno/progreso", "Mi avance"],
  [
    "/alumno/ranked",
    <>
      Puntos <span className="text-vip">VIP</span>
    </>,
  ],
];

/**
 * Solo la marca: un cuadrito ámbar con la V, el rayo y la P recortados del
 * logotipo completo.
 *
 * El recorte va por CSS y no con un PNG aparte para no sumar otro archivo que
 * mantener en sincronía con el logo. La marca ocupa el 46% izquierdo de los
 * 922 px de ancho del original; el `width` de la imagen sale de esa cuenta
 * (lado / 0.46) y el `overflow-hidden` del cuadro tapa el resto.
 */
function MarcaCuadrada({ lado = 34 }: { lado?: number }) {
  const PROPORCION_MARCA = 0.46;

  return (
    <span
      aria-hidden
      // `justify-start`: el recorte tiene que dejar a la vista el BORDE
      // IZQUIERDO del original. Centrado, el cuadro mostraba el medio del
      // logotipo ("P FITN") en vez de la marca.
      className="flex shrink-0 items-center justify-start overflow-hidden rounded-[10px] bg-vip"
      style={{ height: lado, width: lado }}
    >
      <Image
        src="/logo-vip-full.png"
        alt=""
        width={922}
        height={250}
        priority
        style={{
          width: lado / PROPORCION_MARCA,
          maxWidth: "none",
          height: "auto",
          // Negro plano sobre el ámbar: el gris del logotipo original no
          // contrasta lo suficiente en un cuadro de 34 px.
          filter: "brightness(0)",
        }}
      />
    </span>
  );
}

/** Placa detrás del logo: negro sólido y logo a color completo a la izquierda
 * en Espejo (look premium y serio); VIP y Lady mantienen la placa de color de
 * siempre con el mismo logo teñido de negro plano. En Inicio se muestra a
 * tamaño completo; en el resto de las pestañas del alumno, a la mitad. Un
 * `height` explícito (ej. panel de entrenador) siempre gana sobre ese cálculo
 * automático. `corner` ubica un elemento dentro de la placa, en la esquina
 * superior derecha. */
export function Logo({
  className = "",
  height,
  corner,
  compact = false,
}: {
  className?: string;
  height?: number;
  corner?: ReactNode;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const resolvedHeight = height ?? (compact ? 44 : pathname === "/alumno/inicio" ? 70 : 36);
  const spacing = compact ? "rounded-xl px-5 py-2.5" : "rounded-2xl px-6 py-4";

  const compacta = RUTAS_COMPACTAS.find(([ruta]) => pathname.startsWith(ruta));

  if (compacta) {
    const [, titulo] = compacta;
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <MarcaCuadrada />
        <h1 className="text-h3 min-w-0 flex-1 truncate text-text">{titulo}</h1>
        {corner}
      </div>
    );
  }

  return (
    <div
      className={`placa-logo-aero relative flex w-full items-center justify-center ${spacing} ${className}`}
      style={{ background: "var(--logo-plate-bg)" }}
    >
      {corner && <div className="absolute right-3 top-1/2 -translate-y-1/2">{corner}</div>}
      <span className="titulo-espejo-compacto text-h3 font-semibold text-text">Portal VIP</span>
      <span className="marca-steel-fit" aria-label="Steel Fit by VIP Fitness">
        <strong>STEEL FIT</strong>
        <small>by VIP Fitness</small>
      </span>
      <span className="marca-lady-fit" aria-label="Lady Fit by VIP Fitness">
        <strong>LADY FIT</strong>
        <small>by VIP Fitness</small>
      </span>
      {/* Dos imágenes, una sola visible por vez vía CSS (ver globals.css): mismo
          logotipo de siempre en los tres temas — Espejo lo muestra a color
          completo sobre la placa negra (look premium y sobrio); VIP y Lady lo
          tiñen de negro plano vía filtro sobre su placa de color. Alternarlo
          por CSS y no por JS evita el parpadeo del logo equivocado en el
          primer render — el tema ya viene resuelto en el <html> antes del
          primer paint. */}
      <Image
        src="/logo-vip-full.png"
        alt="VIP Fitness Center"
        width={922}
        height={250}
        priority
        className="logo-espejo"
        style={{ height: resolvedHeight, width: "auto", maxWidth: "100%" }}
      />
      <Image
        src="/logo-vip-full.png"
        alt="VIP Fitness Center"
        width={922}
        height={250}
        priority
        className="logo-vip-lady"
        style={{
          height: resolvedHeight,
          width: "auto",
          maxWidth: "100%",
          filter: "brightness(0)",
        }}
      />
    </div>
  );
}
