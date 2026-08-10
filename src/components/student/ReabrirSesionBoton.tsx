"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reabrirSesion } from "@/app/alumno/entrenar/actions";
import { Card } from "@/components/ui/Card";

/** Reabrir es solo para corregir un registro histórico: no inicia una sesión
 * nueva y nunca modifica ni duplica la recompensa ya acreditada. */
export function ReabrirSesionBoton({ sesionId }: { sesionId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="radius-control flex h-12 w-full items-center justify-center gap-2 border border-vip text-body font-medium text-vip">
        <RotateCcw size={18} /> Corregir registro
      </button>
      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setAbierto(false)}>
          <Card padding="p-4" className="w-full max-w-sm">
            <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-2.5"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-vip" /><div><p className="text-body font-semibold text-text">¿Corregir esta sesión?</p><p className="mt-1 text-caption text-text-secondary">Volverás a editar este registro. Los puntos ya ganados se conservan y esta misma sesión no volverá a sumar puntos.</p></div></div>
            <form action={reabrirSesion} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="sesion_id" value={sesionId} />
              <input type="hidden" name="confirmar_reapertura" value="true" />
              <button type="button" onClick={() => setAbierto(false)} className="radius-control h-11 border border-border text-caption font-semibold text-text-secondary">Cancelar</button>
              <button type="submit" className="btn-accion radius-control h-11 text-caption font-semibold">Sí, corregir</button>
            </form>
            </div>
          </Card>
        </div>, document.body
      )}
    </>
  );
}
