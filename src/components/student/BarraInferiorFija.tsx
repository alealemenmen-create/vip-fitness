"use client";

import { useEffect, useRef } from "react";

/**
 * Barra inferior fija, que además publica su alto real en
 * `--alto-nav-alumno`.
 *
 * El buscador fijo de Nutrición se apoya justo encima de esta barra. Antes esa
 * distancia era un número escrito a mano (100 px, calculado sobre una barra de
 * 74) y no coincidía con el alto real: la barra crece con el área segura del
 * iPhone, con la franja de "volver al panel" y con el texto agrandado, así que
 * el borde de abajo del buscador quedaba tapado por los íconos. Midiéndola no
 * hay número que se pueda quedar viejo.
 */
export function BarraInferiorFija({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => {
      document.documentElement.style.setProperty(
        "--alto-nav-alumno",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="panel-aero-inferior franja-segura-inferior fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md"
    >
      {children}
    </div>
  );
}
