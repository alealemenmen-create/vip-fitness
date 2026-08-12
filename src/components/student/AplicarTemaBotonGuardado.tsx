"use client";

import { useEffect } from "react";

/**
 * Corrige el tema de botones al primer render si el de la cuenta (guardado en
 * la base) no coincide con el que ya está aplicado en este navegador —
 * localStorage/dispositivo nuevo, datos del sitio borrados, etc. En ese
 * primer instante puede haber un parpadeo breve al tema por defecto; se
 * corrige apenas monta, y de ahí en más este dispositivo ya queda sincronizado
 * (se guarda en localStorage) sin volver a necesitarlo.
 *
 * `temaGuardado` es `undefined`/`null` en DOS casos bien distintos: la cuenta
 * nunca eligió nada todavía (no hay fila que corregir), o no se pudo leer la
 * base (columna sin migrar, error de red). En ambos casos el script inicial ya
 * mantiene VIP como predeterminado. Solo se corrige con un valor explícito.
 */
export function AplicarTemaBotonGuardado({
  temaGuardado,
}: {
  temaGuardado: string | null | undefined;
}) {
  useEffect(() => {
    if (
      temaGuardado !== "espejo" &&
      temaGuardado !== "vip" &&
      temaGuardado !== "femenino"
    ) {
      return;
    }

    // En un dispositivo nuevo (o en uno que ya usaba el antiguo Lady solo de
    // botones) puede no existir todavía una preferencia de luminosidad. Lady
    // Fit arranca clara sin pisar una elección oscura guardada expresamente.
    if (temaGuardado === "femenino" && localStorage.getItem("vip-theme") === null) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("vip-theme", "light");
    }

    const actual = document.documentElement.getAttribute("data-tema-boton") ?? "espejo";
    if (actual === temaGuardado) return;

    if (temaGuardado === "espejo") {
      document.documentElement.removeAttribute("data-tema-boton");
    } else {
      document.documentElement.setAttribute("data-tema-boton", temaGuardado);
    }
    localStorage.setItem("vip-tema-boton", temaGuardado);
  }, [temaGuardado]);

  return null;
}
