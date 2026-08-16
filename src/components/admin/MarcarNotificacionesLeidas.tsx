"use client";

import { useEffect, useRef } from "react";
import { marcarNotificacionesLeidas } from "@/app/admin/notificaciones/actions";

/** No dibuja nada: al abrir la bandeja marca lo pendiente como leído y
 * refresca para que el globito de la campanita se apague solo. Mismo
 * patrón que `MarcarNoticiasVistas` del lado alumno. */
export function MarcarNotificacionesLeidas({ sinLeer }: { sinLeer: number }) {
  const yaDisparado = useRef(false);

  useEffect(() => {
    if (sinLeer <= 0 || yaDisparado.current) return;
    yaDisparado.current = true;
    void marcarNotificacionesLeidas();
  }, [sinLeer]);

  return null;
}
