"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

/** Sin suscripción real a cambios de `localStorage` de otra pestaña: no hace
 * falta, `cerrar()` de más abajo actualiza el estado local directo. Esta
 * función solo cumple con la forma que pide `useSyncExternalStore`. */
const sinSuscripcion = () => () => {};

/** Lee `localStorage` de forma segura entre servidor y cliente, sin el
 * parpadeo de "mostrar y esconder de golpe" que traía leerlo en un efecto:
 * `useSyncExternalStore` ya resuelve esa sincronización para hooks propios de
 * React, así que no hace falta un `useEffect` con un `setState` síncrono
 * adentro (que el lint de este repo, con las reglas de React Compiler,
 * rechaza). En el servidor no hay `localStorage`, así que se asume cerrada
 * (`getServerSnapshot` devuelve `true`) hasta que el cliente confirme lo
 * contrario. */
function useCerradaGuardada(clave: string): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => localStorage.getItem(clave) === "1",
    () => true
  );
}

/**
 * Envoltorio común para las burbujas flotantes del alumno (aviso importante,
 * cumpleaños): se puede arrastrar a otro punto de la pantalla, y un primer
 * toque saca una X para cerrarla en vez de navegar de una — un toque
 * accidental ya no manda a Noticias sin querer.
 *
 * Cerrarla es solo visual: se guarda en `localStorage` por la clave que se le
 * pase, nunca borra ni oculta nada del lado del servidor. La noticia sigue
 * apareciendo igual, completa, en /alumno/noticias — cerrar la burbuja no es
 * "marcar como visto", es "sacarme esto de encima por ahora".
 */
export function BurbujaFlotante({
  claveCierre,
  href,
  ariaLabel,
  tono,
  children,
}: {
  /** Única por burbuja y por lo que muestra (ej. incluye el id del anuncio o
   * la fecha de hoy) — así cerrar UNA no cierra para siempre las que vengan
   * después con contenido distinto. */
  claveCierre: string;
  href: string;
  ariaLabel: string;
  tono: "error" | "vip";
  children: React.ReactNode;
}) {
  const cerradaGuardada = useCerradaGuardada(claveCierre);
  // Cerrar es instantáneo (evento de clic, no hay que esperar el próximo
  // renderizado del store externo): un flag local aparte, que se combina con
  // lo que ya había en `localStorage` de una sesión anterior.
  const [cerradaEnEstaSesion, setCerradaEnEstaSesion] = useState(false);
  const [mostrarX, setMostrarX] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const arrastre = useRef<{ x: number; y: number; movio: boolean } | null>(null);

  if (cerradaGuardada || cerradaEnEstaSesion) return null;

  const cerrar = () => {
    localStorage.setItem(claveCierre, "1");
    setCerradaEnEstaSesion(true);
  };

  const colores =
    tono === "error"
      ? "border-error bg-error/15 text-error"
      : "border-vip bg-vip/15 text-vip";

  return (
    <div
      className="fixed z-40"
      style={{ bottom: `calc(6rem - ${offset.y}px)`, left: `calc(1rem + ${offset.x}px)` }}
    >
      <Link
        href={href}
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          arrastre.current = { x: e.clientX, y: e.clientY, movio: false };
        }}
        onPointerMove={(e) => {
          if (!arrastre.current) return;
          const dx = e.clientX - arrastre.current.x;
          const dy = e.clientY - arrastre.current.y;
          if (!arrastre.current.movio && Math.hypot(dx, dy) < 6) return;
          arrastre.current.movio = true;
          setOffset((previo) => ({ x: previo.x + dx, y: previo.y + dy }));
          arrastre.current.x = e.clientX;
          arrastre.current.y = e.clientY;
        }}
        onClick={(e) => {
          // Si el gesto fue un arrastre, no es un toque: no hacer nada más
          // (ya se movió la burbuja arriba, en pointermove).
          if (arrastre.current?.movio) {
            e.preventDefault();
            arrastre.current = null;
            return;
          }
          arrastre.current = null;
          // Primer toque: solo revela la X, no navega todavía.
          if (!mostrarX) {
            e.preventDefault();
            setMostrarX(true);
          }
          // Un segundo toque con la X ya visible navega como antes (Link
          // normal, sin preventDefault).
        }}
        className={`relative flex max-w-[75%] touch-none items-center gap-2 rounded-full border px-3 py-2 text-caption font-semibold shadow-lg backdrop-blur-sm ${colores}`}
      >
        {children}
        {mostrarX && (
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cerrar();
            }}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg text-text-secondary"
          >
            <X size={13} />
          </button>
        )}
      </Link>
    </div>
  );
}
