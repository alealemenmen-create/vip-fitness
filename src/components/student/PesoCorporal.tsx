"use client";

import { useActionState, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agregarPeso, eliminarPeso, type FormState } from "@/app/alumno/progreso/actions";
import type { RegistroPeso } from "@/app/alumno/progreso/data";
import { hoyISO } from "@/lib/date";

const initialState: FormState = { error: null, ok: false };

export function PesoCorporal({
  historial,
  soloLectura = false,
}: {
  historial: RegistroPeso[];
  soloLectura?: boolean;
}) {
  const [state, formAction, pending] = useActionState(agregarPeso, initialState);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const datosGrafica = historial.map((p) => ({ fecha: p.fecha.slice(5), kg: p.pesoKg }));

  return (
    <div className="space-y-4">
      <Card className="efecto-3d">
        <p className="text-caption mb-3 text-text-tertiary">PESO CORPORAL (KG)</p>
        {historial.length === 0 ? (
          <p className="text-body py-6 text-center text-text-secondary">
            Todavía no hay registros de peso.
          </p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosGrafica}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "var(--color-text)" }}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="var(--color-vip)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-vip)", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {!soloLectura && (
        <Card>
          <p className="text-caption mb-3 text-text-tertiary">REGISTRAR PESO</p>
          <form action={formAction} className="min-w-0 space-y-3 overflow-hidden">
            <div className="grid min-w-0 grid-cols-1 gap-3">
              <Input name="peso_kg" type="number" step="0.1" min="0.1" placeholder="Peso (kg)" required />
              <Input
                name="fecha"
                type="date"
                defaultValue={hoyISO()}
                max={hoyISO()}
                required
                className="block min-w-0 max-w-full overflow-hidden"
              />
            </div>
            <Input name="observacion" placeholder="Observación (opcional)" />
            {state.error && <p className="text-caption text-error">{state.error}</p>}
            {state.ok && state.aviso && (
              <p className="text-caption text-text-secondary">{state.aviso}</p>
            )}
            {state.ok && state.puntos ? (
              <p className="text-caption font-semibold text-vip">
                +{state.puntos} Puntos VIP por tu seguimiento semanal
              </p>
            ) : null}
            <Button type="submit" variant="outline" loading={pending}>
              {pending ? "Guardando…" : "Guardar peso"}
            </Button>
          </form>
        </Card>
      )}

      {historial.length > 0 && (
        <Card>
          <button
            onClick={() => setMostrarHistorial((v) => !v)}
            className="text-caption w-full text-left text-text-tertiary"
          >
            {mostrarHistorial ? "OCULTAR HISTORIAL" : "VER HISTORIAL COMPLETO"}
          </button>
          {mostrarHistorial && (
            <div className="mt-3 space-y-1">
              {[...historial].reverse().map((p) => (
                <div key={p.id} className="flex items-center justify-between border-t border-border py-3">
                  <div>
                    <p className="text-secondary text-text">{p.fecha}</p>
                    <p className="text-caption text-text-tertiary">
                      Registrado por {p.registradoPorNombre}
                      {p.observacion ? ` · ${p.observacion}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-secondary text-vip">{p.pesoKg} kg</p>
                    {!soloLectura && (
                      <IconButton ariaLabel="Eliminar peso" onClick={() => eliminarPeso(p.id)}>
                        <Trash2 size={16} className="text-error" />
                      </IconButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
