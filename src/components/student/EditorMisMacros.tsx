"use client";

import { useActionState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { guardarMisMacros, type FormState } from "@/app/alumno/macros/actions";

const initialState: FormState = { error: null, ok: false };

function CampoMacro({
  nombre,
  etiqueta,
  sufijo,
  valorInicial,
}: {
  nombre: string;
  etiqueta: string;
  sufijo: string;
  valorInicial: number | null;
}) {
  return (
    <label className="radius-control block border border-border bg-surface-2 px-3 py-2">
      <span className="text-caption text-text-tertiary">{etiqueta}</span>
      <div className="flex items-baseline gap-1">
        <input
          name={nombre}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          defaultValue={valorInicial ?? ""}
          placeholder="0"
          className="text-body w-full min-w-0 bg-transparent text-text outline-none"
        />
        <span className="text-caption shrink-0 text-text-tertiary">{sufijo}</span>
      </div>
    </label>
  );
}

/**
 * Misma lógica que la carga de macros del entrenador
 * (`ArchivosManager.tsx`/`guardarMacrosVariosAlumnos`), pero acá el alumno
 * carga la suya propia — sin tener que esperar a que el entrenador se la
 * suba. La dieta en sí la sigue mandando el entrenador por fuera (WhatsApp);
 * esto es solo la meta numérica que alimenta el progreso de Nutrición.
 */
export function EditorMisMacros({
  planActual,
}: {
  planActual: {
    kcalObjetivo: number | null;
    protObjetivo: number | null;
    carbObjetivo: number | null;
    grasaObjetivo: number | null;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(guardarMisMacros, initialState);

  return (
    <Card>
      <p className="text-card-title text-text">Macros</p>
      <p className="text-caption mt-1 text-text-tertiary">
        Incluye los macros de la dieta que te envía tu entrenador.
      </p>

      <div className="radius-control mt-3 flex gap-2.5 border border-vip/40 bg-vip/5 p-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vip" />
        <p className="text-caption text-text-secondary">
          Este cambio es delicado: los números que cargues aquí reemplazan tu meta activa y son los
          que después controlan tu progreso nutricional. Carga los mismos que te pasó tu
          entrenador.
        </p>
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <CampoMacro
            nombre="kcal_objetivo"
            etiqueta="Calorías"
            sufijo="kcal"
            valorInicial={planActual?.kcalObjetivo ?? null}
          />
          <CampoMacro
            nombre="prot_objetivo"
            etiqueta="Proteína"
            sufijo="g"
            valorInicial={planActual?.protObjetivo ?? null}
          />
          <CampoMacro
            nombre="carb_objetivo"
            etiqueta="Carbohidratos"
            sufijo="g"
            valorInicial={planActual?.carbObjetivo ?? null}
          />
          <CampoMacro
            nombre="grasa_objetivo"
            etiqueta="Grasas"
            sufijo="g"
            valorInicial={planActual?.grasaObjetivo ?? null}
          />
        </div>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && !pending && (
          <p className="text-caption flex items-center gap-1.5 text-success">
            <Check size={14} /> Meta actualizada.
          </p>
        )}

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Guardando…" : "Guardar meta"}
        </Button>
      </form>
    </Card>
  );
}
