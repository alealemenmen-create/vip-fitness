"use client";

import { useEffect, useRef } from "react";
import { marcarNoticiasVistasAction } from "@/app/alumno/noticias/actions";

/**
 * No dibuja nada: al abrir el panel de Noticias marca las novedades como
 * vistas y refresca el layout para que el globito del menú se apague solo.
 * Solo se dispara si de verdad había algo sin ver, para no escribir en la base
 * ni refrescar en cada visita.
 */
export function MarcarNoticiasVistas({ sinVer }: { sinVer: number }) {
  const yaDisparado = useRef(false);

  useEffect(() => {
    if (sinVer <= 0 || yaDisparado.current) return;
    yaDisparado.current = true;
    void marcarNoticiasVistasAction();
  }, [sinVer]);

  return null;
}
