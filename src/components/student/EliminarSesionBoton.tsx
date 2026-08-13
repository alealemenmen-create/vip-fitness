"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle } from "lucide-react";
import { eliminarSesion } from "@/app/alumno/entrenar/actions";
import { Card } from "@/components/ui/Card";

/**
 * Borra el registro entero. Hermano de `ReabrirSesionBoton`, y a propósito
 * más apagado que él: corregir es lo que el alumno va a querer casi siempre,
 * borrar es la excepción (marcó la rutina hecha sin querer).
 *
 * El aviso no dice "¿estás seguro?" sino qué se pierde exactamente, que es lo
 * único que ayuda a decidir.
 */
export function EliminarSesionBoton({ sesionId }: { sesionId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text-tertiary"
      >
        <Trash2 size={16} /> Eliminar registro
      </button>
      {abierto &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setAbierto(false)}
          >
            <Card padding="p-4" className="w-full max-w-sm">
              <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
                  <div>
                    <p className="text-body font-semibold text-text">¿Eliminar este registro?</p>
                    <p className="text-caption mt-1 text-text-secondary">
                      Se borran los kilos y las repeticiones que cargaste, y los Puntos VIP que te
                      dio esta sesión. No queda en el historial y no se puede deshacer.
                    </p>
                    <p className="text-micro mt-1.5 text-text-tertiary">
                      Vas a poder volver a hacer esta sesión desde cero.
                    </p>
                  </div>
                </div>
                <form action={eliminarSesion} className="grid grid-cols-2 gap-2">
                  <input type="hidden" name="sesion_id" value={sesionId} />
                  <input type="hidden" name="confirmar_borrado" value="true" />
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="radius-control h-11 border border-border text-caption font-semibold text-text"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="radius-control h-11 border border-error text-caption font-bold text-error"
                  >
                    Sí, eliminar
                  </button>
                </form>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
