"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { reiniciarPlanAlumno, type FormState } from "@/app/admin/alumnos/actions";

const inicial: FormState = { error: null, ok: false };

/** El alumno vuelve a ver el día 1 de su plan. Nada se borra: la rutina
 * anterior queda archivada con todo su historial intacto (ver comentario de
 * `reiniciarPlanAlumno`), y una nota en su ficha deja constancia real de
 * cuántas sesiones completó antes del reinicio. */
export function ReiniciarPlanAlumno({ alumnoId }: { alumnoId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion, pendiente] = useActionState(reiniciarPlanAlumno, inicial);

  if (estado.ok) {
    return (
      <Card padding="p-3">
        <p className="text-caption font-semibold text-success">Plan reiniciado</p>
        <p className="text-caption mt-1 text-text-secondary">
          El alumno ya ve el día 1. Quedó una nota en su ficha con el detalle de lo que hizo antes del reinicio.
        </p>
      </Card>
    );
  }

  if (!confirmando) {
    return (
      <Card padding="p-3">
        <p className="text-caption text-text-tertiary">REINICIAR PLAN</p>
        <p className="text-caption mt-1 text-text-secondary">
          El alumno vuelve a ver el día 1 de su plan, como si empezara de nuevo. No se borra nada de su historial.
        </p>
        <Button variant="secondary" size="xs" onClick={() => setConfirmando(true)} className="mt-2">
          <RotateCcw size={14} /> Reiniciar plan
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="p-3">
      <p className="text-caption font-semibold text-text">¿Reiniciar el plan de este alumno?</p>
      <p className="text-caption mt-1 text-text-secondary">
        Vuelve a ver el día 1 en su pantalla principal. Su historial real (todas las sesiones que ya hizo) sigue completo y
        vas a poder revisarlo igual que siempre — esto no borra nada.
      </p>
      {estado.error && <p className="text-caption mt-2 text-error">{estado.error}</p>}
      <div className="mt-2 flex gap-2">
        <form action={accion}>
          <input type="hidden" name="alumno_id" value={alumnoId} />
          <Button type="submit" variant="secondary" size="xsAuto" loading={pendiente}>
            Sí, reiniciar
          </Button>
        </form>
        <Button variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
