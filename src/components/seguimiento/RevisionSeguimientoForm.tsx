"use client";

import { useActionState } from "react";
import { guardarRevisionSeguimiento, type RevisionState } from "@/app/admin/alumnos/[id]/seguimiento/actions";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

const inicial: RevisionState = { ok: false, error: null };

export function RevisionSeguimientoForm({ alumnoId, periodo }: { alumnoId: string; periodo: number }) {
  const [estado, accion, pendiente] = useActionState(guardarRevisionSeguimiento, inicial);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="alumno_id" value={alumnoId} />
      <input type="hidden" name="periodo" value={periodo} />
      <div>
        <label className="mb-1 block text-[10px] font-semibold tracking-wide text-text-tertiary">OBSERVACIÓN PARA EL ALUMNO</label>
        <Textarea name="observacion" rows={3} required placeholder="Semana muy buena. Mantener alimentación y técnica..." />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold tracking-wide text-text-tertiary">DECISIÓN PARA EL SIGUIENTE PLAN (OPCIONAL)</label>
        <Textarea name="decision" rows={2} placeholder="Subir volumen de espalda la próxima semana..." />
      </div>
      {estado.error && <p className="text-caption text-error">{estado.error}</p>}
      {estado.ok && <p className="text-caption text-success">Revisión guardada y visible para el alumno.</p>}
      <Button type="submit" loading={pendiente} disabled={pendiente} className="w-full">Guardar revisión del período</Button>
    </form>
  );
}
