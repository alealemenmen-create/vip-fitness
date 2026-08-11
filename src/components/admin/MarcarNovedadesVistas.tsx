"use client";

import { useEffect, useRef } from "react";
import { marcarNovedadesVistasHasta } from "@/lib/novedades-vistas-local";

/** No dibuja nada: al entrar a la página de Actualizaciones, marca la más
 * reciente como vista para que el contador de la navegación se apague solo.
 * Mismo patrón que `MarcarNoticiasVistas` del lado del alumno, pero local: no
 * hay entrenador con sesión abierta en dos dispositivos en este gimnasio. */
export function MarcarNovedadesVistas({ ultimaEn }: { ultimaEn: string | null }) {
  const yaDisparado = useRef(false);

  useEffect(() => {
    if (!ultimaEn || yaDisparado.current) return;
    yaDisparado.current = true;
    marcarNovedadesVistasHasta(ultimaEn);
  }, [ultimaEn]);

  return null;
}
