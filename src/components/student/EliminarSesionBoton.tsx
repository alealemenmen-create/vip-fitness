"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle } from "lucide-react";
import { solicitarBorradoSesion } from "@/app/alumno/entrenar/actions";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";

/**
 * El alumno PIDE que le borren el registro; no lo borra él.
 *
 * Borrar destruye historial sin vuelta atrás y dejarlo a dos toques era
 * demasiado: "si no, cualquiera puede borrarla como si nada" (Alejandro). Se
 * descartó pedir un código del entrenador — uno fijo se filtra solo, uno de un
 * solo uso lo obliga a estar disponible en el momento. El pedido deja la
 * decisión donde tiene que estar y de paso queda constancia de quién la tomó.
 *
 * El motivo es obligatorio a propósito: sin él, el entrenador no tiene con qué
 * decidir y termina aprobando todo.
 */
export function EliminarSesionBoton({ sesionId }: { sesionId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text-tertiary"
      >
        <Trash2 size={16} /> Pedir que borren este registro
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
                  <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
                  <div>
                    <p className="text-body font-semibold text-text">¿Pedir que borren este registro?</p>
                    <p className="text-caption mt-1 text-text-secondary">
                      Borrar elimina los kilos, las repeticiones y los Puntos VIP de esta sesión, y
                      no se puede deshacer. Por eso lo revisa tu entrenador antes.
                    </p>
                    <p className="text-micro mt-1.5 text-text-tertiary">
                      Si solo cargaste un dato mal, es mejor “Corregir registro”: lo editas tú
                      mismo, al instante.
                    </p>
                  </div>
                </div>
                <form action={solicitarBorradoSesion} className="space-y-2">
                  <input type="hidden" name="sesion_id" value={sesionId} />
                  <Textarea
                    name="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="¿Por qué hay que borrarla? Ej: la marqué hecha sin querer"
                    rows={2}
                    maxLength={500}
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAbierto(false)}
                      className="radius-control h-11 border border-border text-caption font-semibold text-text"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={motivo.trim().length === 0}
                      className="btn-accion radius-control h-11 text-caption font-semibold disabled:opacity-40"
                    >
                      Enviar pedido
                    </button>
                  </div>
                </form>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
