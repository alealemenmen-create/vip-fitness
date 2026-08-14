"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** `accion` va a la derecha del título — el cronómetro de la rutina o el
 * botón "Iniciar rutina" en la pantalla de sesión (ver sesion/[id]/page.tsx).
 * Va AFUERA del botón de volver, no adentro: son dos controles, no uno. */
export function VolverAEntrenar({ titulo, accion, compacto = false }: { titulo: string; accion?: ReactNode; compacto?: boolean }) {
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <Link
        href="/alumno/entrenar"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label="Volver a entrenar"
      >
        <ArrowLeft size={20} className="shrink-0 text-text-secondary" />
        <span className={`${compacto ? "text-body font-semibold" : "text-h3"} truncate text-text`}>{titulo}</span>
      </Link>
      {accion}
    </div>
  );
}
