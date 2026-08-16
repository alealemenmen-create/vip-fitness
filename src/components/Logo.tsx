"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Crown, Zap } from "lucide-react";

/**
 * Pantallas que cambian la placa de ancho completo por un encabezado bajito:
 * el cuadrito de la marca (la V, el rayo y la P) a la izquierda y el nombre de
 * la sección al lado. La placa entera se comía la parte de arriba en pantallas
 * que necesitan el alto para su propio contenido.
 *
 * El título es opcional y acepta JSX: "Entrenamiento VIP" lleva el VIP en el
 * color de acento, igual que antes cuando era un <h1> aparte.
 */
const RUTAS_COMPACTAS: [ruta: string, titulo?: ReactNode][] = [];

/**
 * Pantallas con el cabezal universal: escudo hexagonal + título estático +
 * instrumento de puntos/campana/ajustes, igual que entrenamiento activo (ver
 * INSTRUCTIVO_CLAUDE_REDISEÑO..., 2026-08-15). Se suman de a una: Inicio,
 * Entrenar y ahora Nutrición — el resto de las pestañas queda con la marca
 * cuadrada de siempre hasta que les toque.
 *
 * `prefijo: true` compara con `pathname.startsWith(ruta)`: Nutrición vive en
 * `/alumno/comer/<fecha>` (la fecha va en la URL para poder compartir el
 * enlace o recargar sin perder el día), así que la ruta exacta `/alumno/comer`
 * nunca coincide con lo que el alumno tiene abierto. Entrenar e Inicio siguen
 * comparando exacto — no se decidió todavía si sus sub-rutas (historial, la
 * ficha de "Mi entrenamiento") entran al cabezal universal.
 */
const RUTAS_CABECERA_HEXAGONAL: [ruta: string, titulo: ReactNode, prefijo?: boolean][] = [
  ["/alumno/inicio", <span key="fitness" className="titulo-portal-vip-marca">Fitness</span>],
  // "Entrenamiento" a secas y no "Entrenamiento VIP": el título tiene 132 px
  // de ancho útil y la versión con VIP mide 144, así que el "VIP" dorado se
  // perdía SIEMPRE detrás de los puntos suspensivos — y con un saldo de cinco
  // o seis dígitos se comía además parte de la palabra. El instructivo pide el
  // VIP en oro solo "si cabe"; acá no cabe, y el escudo hexagonal de al lado
  // ya pone la marca.
  ["/alumno/entrenar", "Entrenamiento"],
  ["/alumno/comer", "Nutrición", true],
  // Exacto, no prefijo: a diferencia de Nutrición, "Mi avance" no lleva
  // parámetros en la RUTA (el período 7/14/30 va por `?periodo=`, que no
  // afecta el pathname). `/alumno/progreso/imprimir` es una pantalla propia
  // y aparte, pensada para verse sin el shell del alumno encima.
  ["/alumno/progreso", "Mi avance"],
  // Ranked es la excepción iluminada del portal (instructivo §9), pero eso
  // se queda contenido en `.ranked-casino` (el contenido de la pantalla, ya
  // construido desde el 2026-08-12 — halo, diamante, tabla). El cabezal en
  // sí es el mismo sobrio de siempre: "el brillo vive dentro del contenido
  // Ranked; el cabezal y la barra no se transforman en neón".
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

/** Escudo hexagonal `VIP`: marca permanente del shell del alumno. Nace en
 * entrenamiento activo y se comparte con el resto del portal (por ahora,
 * Inicio) para que el alumno no vea tres identidades distintas al navegar. */
function MarcaVipPortal() {
  return (
    <span className="marca-vip-entrenamiento" aria-label="VIP Fitness">
      <span>VIP</span>
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
  puntosVip = 0,
}: {
  className?: string;
  height?: number;
  corner?: ReactNode;
  compact?: boolean;
  puntosVip?: number;
}) {
  const pathname = usePathname();
  const [tituloRutinaActiva, setTituloRutinaActiva] = useState("");
  useEffect(() => {
    const actualizar = (evento: Event) => {
      setTituloRutinaActiva((evento as CustomEvent<string>).detail ?? "");
    };
    window.addEventListener("vip:titulo-rutina", actualizar);
    return () => window.removeEventListener("vip:titulo-rutina", actualizar);
  }, []);
  // Puntos Ranked "preparados" de la sesión en curso (ver SesionEjercicios.tsx):
  // se suman al saldo de la corona para que se vea subir en vivo mientras se
  // entrena. Son una previsualización — los puntos reales recién se confirman
  // al Finalizar, esto no escribe nada en la base.
  const [puntosEnVivo, setPuntosEnVivo] = useState(0);
  useEffect(() => {
    const actualizar = (evento: Event) => {
      setPuntosEnVivo((evento as CustomEvent<number>).detail ?? 0);
    };
    window.addEventListener("vip:puntos-en-vivo", actualizar);
    return () => window.removeEventListener("vip:puntos-en-vivo", actualizar);
  }, []);
  const resolvedHeight = height ?? (compact ? 44 : pathname === "/alumno/inicio" ? 70 : 36);
  const spacing = compact ? "rounded-xl px-5 py-2.5" : "rounded-2xl px-6 py-4";

  const compacta = RUTAS_COMPACTAS.find(([ruta]) => pathname.startsWith(ruta));

  if (pathname.startsWith("/alumno/entrenar/sesion/")) {
    const [numeroSesion, ...nombreDia] = tituloRutinaActiva.split("·").map((parte) => parte.trim());
    return (
      <div className={`logo-rutina-activa flex items-center ${className}`}>
        <MarcaVipPortal />
        <span className="titulo-rutina-activa min-w-0 flex-1 truncate">
          <b>{numeroSesion || "VIP"}</b>
          {nombreDia.length > 0 && <span>{nombreDia.join(" · ")}</span>}
        </span>
        <div className="utilidades-rutina-activa">
          <span
            className="puntos-rutina-activa"
            aria-label={`${(puntosVip + puntosEnVivo).toLocaleString("es-CL")} puntos VIP`}
          >
            <span className="insignia-puntos-rutina" aria-hidden>
              <Crown size={15} strokeWidth={1.7} />
              <Zap size={8} fill="currentColor" strokeWidth={2.4} />
            </span>
            <strong>{(puntosVip + puntosEnVivo).toLocaleString("es-CL")}</strong>
          </span>
          {corner}
        </div>
      </div>
    );
  }

  // Cabezal universal del Portal VIP: mismo escudo hexagonal e instrumento de
  // puntos/campana/ajustes que entrenamiento activo, con título estático de
  // sección (INSTRUCTIVO_CLAUDE_REDISEÑO..., 2026-08-15).
  const cabeceraHexagonal = RUTAS_CABECERA_HEXAGONAL.find(([ruta, , prefijo]) =>
    prefijo ? pathname.startsWith(ruta) : pathname === ruta
  );
  if (cabeceraHexagonal) {
    const [, titulo] = cabeceraHexagonal;
    return (
      <div className={`cabecera-portal-vip ${className}`}>
        <MarcaVipPortal />
        <h1 className="titulo-portal-vip">{titulo}</h1>
        <div className="instrumento-portal-vip">
          <span
            className="puntos-rutina-activa"
            aria-label={`${(puntosVip + puntosEnVivo).toLocaleString("es-CL")} puntos VIP`}
          >
            <span className="insignia-puntos-rutina" aria-hidden>
              <Crown size={15} strokeWidth={1.7} />
              <Zap size={8} fill="currentColor" strokeWidth={2.4} />
            </span>
            <strong>{(puntosVip + puntosEnVivo).toLocaleString("es-CL")}</strong>
          </span>
          {corner}
        </div>
      </div>
    );
  }

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
