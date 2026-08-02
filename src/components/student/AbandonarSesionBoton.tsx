"use client";

import { useState } from "react";
import { CircleOff, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { abandonarSesion } from "@/app/alumno/entrenar/actions";

/** Botón "Abandonar" de una sesión ya cerrada, en el Historial — con
 * confirmación en ventana emergente. A diferencia de un borrado, la sesión
 * sigue en el historial: solo cambia su estado y deja de sumar puntos. */
export function AbandonarSesionBoton({ sesionId }: { sesionId: string }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Abandonar entrenamiento"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirmando(true);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary active:scale-[0.94]"
      >
        <CircleOff size={16} />
      </button>

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Card padding="p-4" className="w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-body font-medium text-text">¿Abandonar este entrenamiento?</p>
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
              Queda marcado como abandonado y le quita los puntos que había sumado. Sigue
              apareciendo en tu historial.
            </p>
            <form action={abandonarSesion} className="flex gap-2">
              <input type="hidden" name="sesion_id" value={sesionId} />
              <Button
                type="button"
                variant="secondary"
                size="xsAuto"
                className="flex-1"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" size="xsAuto" className="flex-1">
                Sí, abandonar
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
