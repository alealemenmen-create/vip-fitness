"use client";

import { useActionState } from "react";
import { actualizarPerfilAlumno, type FormState } from "@/app/admin/alumnos/actions";
import { Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const initialState: FormState = { error: null, ok: false };

export function PerfilAlumnoForm({
  alumnoId,
  objetivo,
  proximoControlFecha,
}: {
  alumnoId: string;
  objetivo: string | null;
  proximoControlFecha: string | null;
}) {
  const [state, formAction, pending] = useActionState(actualizarPerfilAlumno, initialState);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="alumno_id" value={alumnoId} />
      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">OBJETIVO</label>
        <Select name="objetivo" defaultValue={objetivo ?? ""} className="!py-1.5 text-caption">
          <option value="">Pendiente de definir</option>
          <option value="Pérdida de grasa">Pérdida de grasa</option>
          <option value="Aumento de masa muscular">Aumento de masa muscular</option>
          <option value="Recomposición corporal">Recomposición corporal</option>
          <option value="Mejorar condición física">Mejorar condición física</option>
        </Select>
      </div>
      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">PRÓXIMO CONTROL</label>
        <Input
          type="date"
          name="proximo_control_fecha"
          defaultValue={proximoControlFecha ?? ""}
          className="!py-1.5 text-caption"
        />
      </div>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && <p className="text-caption text-success">Guardado.</p>}
      <Button type="submit" variant="success" loading={pending} size="xs">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
