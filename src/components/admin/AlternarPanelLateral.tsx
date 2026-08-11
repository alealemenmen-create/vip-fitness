"use client";

import { useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const CLAVE = "vip-panel-lateral-admin";
const ATRIBUTO = "data-panel-admin";

/**
 * Mostrar u ocultar la barra lateral del panel del entrenador.
 *
 * El caso que lo motivó: el teléfono en horizontal. Ahí el ancho pasa de 768px,
 * así que la barra lateral aparece como en un computador… pero la altura queda
 * en ~390px y no entra nada — el logo, la ficha del entrenador y la lista de
 * secciones se apelotonan y la mitad queda fuera de la pantalla.
 *
 * En vez de inventar una tercera disposición para ese caso, la barra pasa a
 * poder esconderse siempre: se arranca oculta cuando la pantalla es baja
 * (horizontal), visible cuando hay altura de sobra (computador), y el
 * entrenador manda con un botón. La elección queda guardada en el aparato.
 *
 * Cómo se aplica: este componente solo escribe `data-panel-admin` en el <html>
 * y el CSS hace el resto (ver globals.css). Así el layout puede seguir siendo
 * un Server Component y el botón puede aparecer en dos lugares distintos —el
 * que cierra vive dentro de la barra, el que abre queda flotando arriba a la
 * izquierda— sin pasarse estado entre ellos.
 */
export function AlternarPanelLateral({ modo }: { modo: "abrir" | "cerrar" }) {
  // Sin estado de React a propósito: quién se ve lo decide el CSS a partir del
  // atributo, así que guardarlo también en React sería la misma verdad en dos
  // lados (y las reglas del React Compiler de este repo no dejan sincronizar
  // eso con un setState dentro de un efecto). El efecto solo escribe el DOM.
  useEffect(() => {
    if (document.documentElement.hasAttribute(ATRIBUTO)) return;
    const guardado = localStorage.getItem(CLAVE);
    // Sin preferencia guardada decide la pantalla: menos de 560px de alto es
    // un teléfono acostado (o una ventana muy baja), y ahí la barra estorba
    // más de lo que ayuda.
    const visible = guardado === null ? window.innerHeight >= 560 : guardado === "1";
    document.documentElement.setAttribute(ATRIBUTO, visible ? "visible" : "oculto");
  }, []);

  const alternar = () => {
    const proximo = document.documentElement.getAttribute(ATRIBUTO) !== "oculto" ? "oculto" : "visible";
    localStorage.setItem(CLAVE, proximo === "visible" ? "1" : "0");
    document.documentElement.setAttribute(ATRIBUTO, proximo);
  };

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={modo === "abrir" ? "Mostrar panel lateral" : "Ocultar panel lateral"}
      title={modo === "abrir" ? "Mostrar panel lateral" : "Ocultar panel lateral"}
      className={
        modo === "abrir"
          ? "boton-mostrar-panel-lateral"
          : "radius-control flex h-8 w-8 items-center justify-center border border-border bg-surface text-text-secondary"
      }
    >
      {modo === "abrir" ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={16} />}
    </button>
  );
}
