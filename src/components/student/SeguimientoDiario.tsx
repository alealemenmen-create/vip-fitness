"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { guardarSeguimiento, type GuardarSeguimientoState } from "@/app/alumno/inicio/actions";
import type { SeguimientoHoy } from "@/app/alumno/inicio/data";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

const initialState: GuardarSeguimientoState = { error: null, guardado: false };

function ToggleSiNo({
  name,
  valorInicial,
}: {
  name: string;
  valorInicial: boolean | null;
}) {
  const [valor, setValor] = useState<boolean | null>(valorInicial);
  return (
    <div className="flex gap-2">
      <input type="hidden" name={name} value={valor === null ? "" : String(valor)} />
      {[
        { label: "Sí", v: true },
        { label: "No", v: false },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => setValor(opt.v)}
          className={`radius-control text-secondary flex-1 py-2.5 font-medium transition-colors duration-200 ease-in-out ${
            valor === opt.v ? "btn-accion" : "bg-surface-2 text-text-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function EscalaEnergia({ valorInicial }: { valorInicial: number | null }) {
  const [valor, setValor] = useState<number | null>(valorInicial);
  return (
    <div className="flex gap-2">
      <input type="hidden" name="energia" value={valor ?? ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValor(n)}
          className={`text-secondary radius-control h-10 w-10 transition-colors duration-200 ease-in-out ${
            valor === n ? "btn-accion" : "bg-surface-2 text-text-secondary"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function SeguimientoDiario({ seguimientoHoy }: { seguimientoHoy: SeguimientoHoy }) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(guardarSeguimiento, initialState);

  return (
    <>
      <Button variant="accion" onClick={() => setAbierto(true)} className="justify-between">
        {seguimientoHoy ? "Editar seguimiento diario" : "Completar seguimiento diario"}
      </Button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="radius-card max-h-[85vh] w-full overflow-y-auto bg-surface p-6 sm:max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h3 text-text">Seguimiento diario</h2>
              <button onClick={() => setAbierto(false)}>
                <X size={22} className="text-text-secondary" />
              </button>
            </div>

            {state.guardado ? (
              <div className="py-8 text-center">
                <p className="text-body text-text">Seguimiento guardado correctamente.</p>
                <button
                  onClick={() => setAbierto(false)}
                  className="text-secondary mt-4 font-semibold text-vip"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <div>
                  <p className="text-secondary mb-2 text-text-secondary">¿Entrenaste hoy?</p>
                  <ToggleSiNo
                    name="entreno_hoy"
                    valorInicial={seguimientoHoy?.entreno_hoy ?? null}
                  />
                </div>
                <div>
                  <p className="text-secondary mb-2 text-text-secondary">
                    ¿Cumpliste tu alimentación?
                  </p>
                  <ToggleSiNo
                    name="cumplio_alimentacion"
                    valorInicial={seguimientoHoy?.cumplio_alimentacion ?? null}
                  />
                </div>
                <div>
                  <label className="text-secondary mb-2 block text-text-secondary">
                    ¿Cuánta agua bebiste? (litros)
                  </label>
                  <Input
                    name="agua_litros"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    defaultValue={seguimientoHoy?.agua_litros ?? ""}
                  />
                </div>
                <div>
                  <label className="text-secondary mb-2 block text-text-secondary">
                    ¿Cuántas horas dormiste?
                  </label>
                  <Input
                    name="horas_sueno"
                    type="number"
                    step="0.5"
                    min="0"
                    inputMode="decimal"
                    defaultValue={seguimientoHoy?.horas_sueno ?? ""}
                  />
                </div>
                <div>
                  <p className="text-secondary mb-2 text-text-secondary">
                    ¿Cómo estuvo tu nivel de energía?
                  </p>
                  <EscalaEnergia valorInicial={seguimientoHoy?.energia ?? null} />
                </div>
                <div>
                  <label className="text-secondary mb-2 block text-text-secondary">
                    ¿Tienes alguna molestia?
                  </label>
                  <Input
                    name="molestias"
                    type="text"
                    defaultValue={seguimientoHoy?.molestias ?? ""}
                  />
                </div>
                <div>
                  <label className="text-secondary mb-2 block text-text-secondary">
                    Comentario opcional
                  </label>
                  <Textarea
                    name="comentario"
                    rows={2}
                    defaultValue={seguimientoHoy?.comentario ?? ""}
                  />
                </div>

                {state.error && <p className="text-caption text-error">{state.error}</p>}

                <Button type="submit" variant="accion" loading={pending} className="mt-2">
                  {pending ? "Guardando…" : "Guardar seguimiento"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
