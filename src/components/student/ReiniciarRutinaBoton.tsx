"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { reiniciarRutina } from "@/app/alumno/entrenar/actions";

/** Reinicia una rutina de cero: borra todas las sesiones registradas bajo
 * ella (el calendario de Entrenar vuelve a Día 1) sin tocar los Puntos VIP
 * ya ganados — confirmación en dos pasos porque no se puede deshacer, mismo
 * patrón que `AbandonarSesionBoton` y `EliminarPerfilBoton`. */
export function ReiniciarRutinaBoton({
  rutinaId,
  cantidadSesiones,
}: {
  rutinaId: string;
  cantidadSesiones: number;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={() => setConfirmando(true)}
      >
        <RotateCcw size={16} /> Reiniciar rutina de cero
      </Button>

      {confirmando &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Card padding="p-4" className="w-full max-w-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-medium text-text">¿Reiniciar esta rutina?</p>
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
                Se {cantidadSesiones === 1 ? "borra la" : `borran las ${cantidadSesiones}`}{" "}
                {cantidadSesiones === 1 ? "sesión registrada" : "sesiones registradas"} bajo esta
                rutina — el calendario de Entrenar vuelve a empezar desde el Día 1. Los Puntos VIP
                que ya ganaste no se tocan. Esto no se puede deshacer.
              </p>
              <form action={reiniciarRutina} className="flex gap-2">
                <input type="hidden" name="rutina_id" value={rutinaId} />
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
                  Sí, reiniciar
                </Button>
              </form>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
