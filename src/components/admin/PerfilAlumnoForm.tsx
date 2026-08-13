"use client";

import { useActionState, useState } from "react";
import { actualizarPerfilAlumno, type FormState } from "@/app/admin/alumnos/actions";
import { Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PLANES_ENTRENAMIENTO } from "@/lib/planes-entrenamiento";
import type { CodigoPlanEntrenamiento } from "@/lib/supabase/types";

const initialState: FormState = { error: null, ok: false };

export function PerfilAlumnoForm({
  alumnoId,
  objetivo,
  proximoControlFecha,
  planEntrenamiento,
  sesionesMensuales,
  diasSemana,
  planPausado,
  temporizadorDescanso,
}: {
  alumnoId: string;
  objetivo: string | null;
  proximoControlFecha: string | null;
  planEntrenamiento: CodigoPlanEntrenamiento | null;
  sesionesMensuales: number | null;
  diasSemana: number | null;
  planPausado: boolean;
  temporizadorDescanso: boolean;
}) {
  const [state, formAction, pending] = useActionState(actualizarPerfilAlumno, initialState);
  const [plan, setPlan] = useState<CodigoPlanEntrenamiento | "">(planEntrenamiento ?? "");
  const [sesiones, setSesiones] = useState<number | "">(sesionesMensuales ?? "");
  const [dias, setDias] = useState<number | "">(diasSemana ?? "");

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="alumno_id" value={alumnoId} />
      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">PLAN DE ENTRENAMIENTO</label>
        <Select
          name="plan_entrenamiento"
          value={plan}
          onChange={(event) => {
            const codigo = event.target.value as CodigoPlanEntrenamiento | "";
            setPlan(codigo);
            if (!codigo) {
              setSesiones("");
              setDias("");
              return;
            }
            setSesiones(PLANES_ENTRENAMIENTO[codigo].sesionesMensuales);
            setDias(PLANES_ENTRENAMIENTO[codigo].diasSemana);
          }}
          className="!py-1.5 text-caption"
        >
          <option value="">Pendiente de asignar</option>
          {Object.values(PLANES_ENTRENAMIENTO).map((plan) => (
            <option key={plan.codigo} value={plan.codigo}>
              {plan.nombre} · {plan.sesionesMensuales} sesiones · {plan.diasSemana}/semana
              {plan.precioCLP ? ` · $${plan.precioCLP.toLocaleString("es-CL")}` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] mb-0.5 block text-text-tertiary">SESIONES/MES</label>
          <Input type="number" name="sesiones_mensuales" min="1" max="31" value={sesiones} onChange={(event) => setSesiones(event.target.value ? Number(event.target.value) : "")} placeholder="Según plan" className="!py-1.5 text-caption" />
        </div>
        <div>
          <label className="text-[9px] mb-0.5 block text-text-tertiary">DÍAS/SEMANA</label>
          <Input type="number" name="dias_entrenamiento_semana" min="1" max="7" value={dias} onChange={(event) => setDias(event.target.value ? Number(event.target.value) : "")} placeholder="Según plan" className="!py-1.5 text-caption" />
        </div>
      </div>
      <label className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-2 text-caption text-text-secondary">
        <input type="checkbox" name="plan_entrenamiento_pausado" defaultChecked={planPausado} />
        Pausar nuevas sesiones (mantiene historial y puntos)
      </label>
      {/* A quien el reloj le estorba, se lo quitas desde acá. Va debajo del
          plan porque es lo mismo: una condición del alumno, no una
          preferencia que él pueda cambiarse solo. */}
      <label className="radius-control flex items-start gap-2 border border-border bg-surface-2 px-2.5 py-2 text-caption text-text-secondary">
        <input
          type="checkbox"
          name="sin_temporizador_descanso"
          defaultChecked={!temporizadorDescanso}
          className="mt-0.5"
        />
        <span>
          Sin temporizador de descanso
          <span className="text-micro mt-0.5 block text-text-tertiary">
            No corre la cuenta regresiva entre series ni se descuentan puntos por
            descansar de más. Los segundos programados se siguen viendo como
            referencia.
          </span>
        </span>
      </label>
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
