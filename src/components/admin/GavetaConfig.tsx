"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Cada bloque de Configuración va en su propia gaveta, plegada por defecto:
 * antes era una sola pantalla larga con seis secciones abiertas a la vez.
 * Envuelve nada más — no toca ninguna lógica de las secciones que contiene,
 * solo decide si se ven o no.
 */
export function GavetaConfig({
  titulo,
  subtitulo,
  abiertaPorDefecto = false,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  abiertaPorDefecto?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="radius-control flex w-full items-center justify-between border border-border bg-surface px-4 py-3"
      >
        <div className="text-left">
          <p className="text-secondary font-semibold text-text">{titulo}</p>
          {subtitulo && <p className="text-caption mt-0.5 text-text-tertiary">{subtitulo}</p>}
        </div>
        {abierta ? (
          <ChevronUp size={18} className="shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-text-secondary" />
        )}
      </button>
      {abierta && <div className="space-y-3">{children}</div>}
    </div>
  );
}
