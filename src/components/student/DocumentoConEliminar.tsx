"use client";

import { useActionState, useState } from "react";
import { FileText, Download, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatFechaCorta } from "@/lib/date";
import { eliminarMiDocumento, type AccionState } from "@/app/alumno/documentos/actions";
import type { Documento } from "@/app/alumno/documentos/data";

const initialState: AccionState = { error: null, ok: false };

/** Fila de "Mis planes" con botón de eliminar y confirmación en ventana
 * emergente — separado de `ListaDocumentos` porque necesita estado de
 * cliente (el modal) y esa lista también la usa el panel del entrenador,
 * donde no hay nada que el alumno pueda borrar. */
export function DocumentoConEliminar({ documento }: { documento: Documento }) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, formAction, pending] = useActionState(eliminarMiDocumento, initialState);

  if (state.ok) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <a
          href={documento.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`block flex-1 min-w-0 ${!documento.url ? "pointer-events-none opacity-50" : ""}`}
        >
          <Card padding="p-2" className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={13} className="text-vip" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-caption truncate text-text">{documento.nombreArchivo}</p>
              <p className="text-[9px] text-text-tertiary">{formatFechaCorta(documento.fechaAsignacion)}</p>
            </div>
            <Download size={13} className="text-text-tertiary" />
          </Card>
        </a>
        <button
          type="button"
          aria-label="Eliminar plan"
          onClick={() => setConfirmando(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary active:scale-[0.94]"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <Card padding="p-4" className="w-full max-w-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-body font-medium text-text">¿Eliminar este plan?</p>
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
              {documento.nombreArchivo} — dejará de aparecer en tu panel. Si lo necesitas de
              nuevo, pídeselo a tu entrenador.
            </p>
            {state.error && <p className="text-caption text-error">{state.error}</p>}
            <form action={formAction} className="flex gap-2">
              <input type="hidden" name="documento_id" value={documento.id} />
              <Button
                type="button"
                variant="secondary"
                size="xsAuto"
                className="flex-1"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" size="xsAuto" className="flex-1" loading={pending}>
                Sí, eliminar
              </Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
