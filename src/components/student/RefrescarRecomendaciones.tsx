"use client";

import { useEffect, useRef } from "react";
import { refrescarRecomendaciones } from "@/app/alumno/entrenar/impulso-actions";

/**
 * Sin pantalla propia: entra a la sesión, intenta una vez, listo.
 *
 * Cierra el punto flojo de las metas de Impulso VIP: se generan una sola vez,
 * al crear la sesión, y si en ese momento un ejercicio no tenía historial
 * utilizable se queda sin meta para siempre — no hay ningún otro disparador
 * que lo reintente. Le pasó a Alejandro: creó una sesión un minuto antes de
 * terminar de corregir la que le faltaba, y quedó sin ninguna meta aunque el
 * historial mejoró casi enseguida.
 *
 * `useRef` en vez de depender de `sesionId` en el array de efectos: la
 * sesión no cambia mientras el componente sigue montado, así que alcanza con
 * una vez por visita — no hace falta reintentar en cada re-render.
 */
export function RefrescarRecomendaciones({ sesionId }: { sesionId: string }) {
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (yaIntentado.current) return;
    yaIntentado.current = true;
    void refrescarRecomendaciones(sesionId);
  }, [sesionId]);

  return null;
}
