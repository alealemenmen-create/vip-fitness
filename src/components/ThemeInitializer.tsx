"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    try {
      const tema = localStorage.getItem("vip-theme");
      if (tema === "light") document.documentElement.setAttribute("data-theme", "light");

      const boton = localStorage.getItem("vip-tema-boton");
      if (boton === "vip" || boton === "masculino" || boton === "femenino") {
        document.documentElement.setAttribute("data-tema-boton", boton);
      } else if (boton !== "espejo") {
        document.documentElement.setAttribute("data-tema-boton", "vip");
        localStorage.setItem("vip-tema-boton", "vip");
      }

      let zoom = Number.parseFloat(localStorage.getItem("vip-zoom-pantalla") ?? "");
      if (!(zoom >= 0.8 && zoom <= 1.15)) {
        const anterior = Number.parseFloat(localStorage.getItem("vip-escala-texto") ?? "");
        zoom = anterior >= 1.15 ? 1.15 : anterior <= 0.8 ? 0.8 : anterior <= 0.9 ? 0.9 : 1;
      }
      document.documentElement.style.setProperty("--zoom-pantalla", String(zoom));
      document.documentElement.setAttribute("data-zoom-pantalla", String(zoom));
    } catch {
      // El almacenamiento puede estar bloqueado; la interfaz conserva sus valores predeterminados.
    }
  }, []);

  return null;
}
