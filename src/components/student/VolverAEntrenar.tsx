"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** `accion` va a la derecha del título — el cronómetro de la rutina o el
 * botón "Iniciar rutina" en la pantalla de sesión (ver sesion/[id]/page.tsx).
 * Va AFUERA del botón de volver, no adentro: son dos controles, no uno. */
export function VolverAEntrenar({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  const router = useRouter();

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => router.push("/alumno/entrenar")}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label="Volver a entrenar"
      >
        <ArrowLeft size={20} className="shrink-0 text-text-secondary" />
        <span className="text-h3 truncate text-text">{titulo}</span>
      </button>
      {accion}
    </div>
  );
}
