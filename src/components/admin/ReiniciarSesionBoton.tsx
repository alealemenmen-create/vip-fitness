"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { reiniciarSesionAlumno, type FormState } from "@/app/admin/alumnos/actions";

const inicial: FormState = { error: null, ok: false };

/** Botón compacto por sesión: reabre un entrenamiento que quedó registrado
 * o completado por error, para que el alumno pueda corregirlo. No borra
 * nada — ni el historial ni los Puntos VIP ya ganados, que son inmutables
 * por diseño. Solo vuelve la sesión a "en progreso". */
export function ReiniciarSesionBoton({ alumnoId, sesionId }: { alumnoId: string; sesionId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion, pendiente] = useActionState(reiniciarSesionAlumno, inicial);

  if (estado.ok) {
    return <p className="text-[10px] font-semibold text-success">Sesión reabierta</p>;
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex items-center gap-1 text-[10px] text-text-tertiary underline hover:text-text-secondary"
      >
        <RotateCcw size={11} /> Reabrir
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-[10px] text-text-secondary">¿Reabrir esta sesión para que la corrija? No se borra nada.</p>
      {estado.error && <p className="text-[10px] text-error">{estado.error}</p>}
      <div className="flex gap-1.5">
        <form action={accion}>
          <input type="hidden" name="alumno_id" value={alumnoId} />
          <input type="hidden" name="sesion_id" value={sesionId} />
          <Button type="submit" variant="secondary" size="xsAuto" loading={pendiente}>
            Sí, reabrir
          </Button>
        </form>
        <Button variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
