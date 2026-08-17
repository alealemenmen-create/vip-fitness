"use client";

import { useSyncExternalStore } from "react";

/**
 * Si el ejercicio activo tiene video, por defecto se muestra la foto quieta
 * con el botón de reproducir — tocarlo abre el video completo. Pedido de
 * Alejandro (16-ago): el video reproduciéndose solo tapando la foto no era
 * lo que quería por defecto; que reproducirse automático sea una preferencia
 * que el alumno prende si quiere, no el comportamiento de entrada.
 *
 * Vive en el navegador (no en la base): es una preferencia de cómo mirar la
 * pantalla en ESTE dispositivo, no un dato del alumno que el entrenador
 * necesite ver.
 */
const CLAVE = "vip:autoplay-video-referencia";

// Sin suscripción real a cambios de otra pestaña: no hace falta, `cambiar()`
// de más abajo actualiza notificando a este mismo hook.
const oyentes = new Set<() => void>();
const suscribir = (avisar: () => void) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};

/** Mismo criterio que `useCerradaGuardada` en BurbujaFlotante.tsx: leer
 * `localStorage` con `useSyncExternalStore` evita el `useEffect` con
 * `setState` síncrono adentro que el lint de este repo rechaza (reglas de
 * React Compiler), sin el parpadeo de "prender y apagar de golpe". En el
 * servidor no hay `localStorage`, así que se asume apagado hasta que el
 * cliente confirme lo contrario. */
export function useAutoplayVideoPreferido(): [boolean, (valor: boolean) => void] {
  const preferido = useSyncExternalStore(
    suscribir,
    () => localStorage.getItem(CLAVE) === "1",
    () => false
  );

  const cambiar = (valor: boolean) => {
    try {
      localStorage.setItem(CLAVE, valor ? "1" : "0");
    } catch {
      // Preferencia no persiste esta sesión — no es crítico.
    }
    oyentes.forEach((avisar) => avisar());
  };

  return [preferido, cambiar];
}
