"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/app/admin/alumnos/actions";

const initialState: FormState = { error: null, ok: false };

/** Botón "Eliminar" con confirmación en dos pasos — nada se borra con un solo
 * click, hay que confirmar explícitamente antes de disparar la acción. */
export function EliminarPerfilBoton({
  accion,
  campoId,
  valorId,
  etiqueta,
  advertencia,
}: {
  accion: (prevState: FormState, formData: FormData) => Promise<FormState>;
  campoId: string;
  valorId: string;
  etiqueta: string;
  advertencia: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, formAction, pending] = useActionState(accion, initialState);

  if (!confirmando) {
    return (
      <Button variant="destructive" size="xsAuto" onClick={() => setConfirmando(true)}>
        <Trash2 size={12} /> {etiqueta}
      </Button>
    );
  }

  return (
    <div className="radius-control space-y-1.5 border border-error/40 bg-error/5 p-2">
      <p className="text-caption text-text">{advertencia}</p>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <div className="flex gap-2">
        <form action={formAction}>
          <input type="hidden" name={campoId} value={valorId} />
          <Button type="submit" variant="destructive" size="xsAuto" loading={pending}>
            Sí, eliminar definitivamente
          </Button>
        </form>
        <Button variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
