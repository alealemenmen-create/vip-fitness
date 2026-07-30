"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import type { RegistroPeso } from "@/app/alumno/progreso/data";

export function PesoCorporalSoloLectura({ historial }: { historial: RegistroPeso[] }) {
  if (historial.length === 0) {
    return (
      <Card>
        <p className="text-caption mb-2 text-text-tertiary">PESO CORPORAL (KG)</p>
        <p className="text-body py-4 text-center text-text-secondary">Todavía no hay registros de peso.</p>
      </Card>
    );
  }

  const datosGrafica = historial.map((p) => ({ fecha: p.fecha.slice(5), kg: p.pesoKg }));
  const ultimo = historial[historial.length - 1];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-caption text-text-tertiary">PESO CORPORAL (KG)</p>
        <p className="text-secondary text-vip">{ultimo.pesoKg} kg</p>
      </div>
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
    </Card>
  );
}
