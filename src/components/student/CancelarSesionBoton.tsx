"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cancelarSesionEnCurso } from "@/app/alumno/entrenar/actions";

/** Para cuando se tocó "Entrenar" en el día equivocado por error: borra esta
 * sesión puntual (sin tocar el resto del historial de la rutina) siempre que
 * todavía no se haya completado ningún ejercicio. */
export function CancelarSesionBoton({ sesionId }: { sesionId: string }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="radius-control flex h-12 w-full items-center justify-center gap-2 text-body font-medium text-text-tertiary underline"
      >
        Empecé este día por error
      </button>

      {confirmando &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Card padding="p-4" className="w-full max-w-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-medium text-text">¿Cancelar este entrenamiento?</p>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setConfirmando(false)}
                  className="text-text-tertiary"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-caption text-text-secondary">
                Se borra por completo, como si nunca lo hubieras tocado. No queda en tu historial
                ni afecta tu ranking.
              </p>
              <form action={cancelarSesionEnCurso} className="flex gap-2">
                <input type="hidden" name="sesion_id" value={sesionId} />
                <Button
                  type="button"
                  variant="secondary"
                  size="xsAuto"
                  className="flex-1"
                  onClick={() => setConfirmando(false)}
                >
                  Volver
                </Button>
                <Button type="submit" variant="destructive" size="xsAuto" className="flex-1">
                  Sí, cancelar
                </Button>
              </form>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
