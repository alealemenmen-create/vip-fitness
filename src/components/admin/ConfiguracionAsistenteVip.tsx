"use client";

import { useActionState } from "react";
import { Bot, DollarSign, ShieldCheck } from "lucide-react";
import { actualizarConfiguracionAsistente, type ConfiguracionState } from "@/app/admin/configuracion/actions";
import type { ConfiguracionAsistenteVip as Config } from "@/lib/asistente/configuracion";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const INICIAL: ConfiguracionState = { ok: false, mensaje: "" };

export function ConfiguracionAsistenteVip({ config }: { config: Config }) {
  const [estado, accion, pendiente] = useActionState(actualizarConfiguracionAsistente, INICIAL);
  const pct = config.presupuestoMensualUsd > 0 ? Math.min(100, (config.gastadoMesUsd / config.presupuestoMensualUsd) * 100) : 100;
  return (
    <Card className="border border-border !p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vip/10 text-vip"><Bot size={20} /></span>
        <div>
          <p className="text-card-title text-text">Asistente VIP con IA</p>
          <p className="text-caption mt-0.5 text-text-tertiary">Presupuesto único para entrenador y alumnos.</p>
        </div>
      </div>

      {!config.disponible ? (
        <p className="text-caption rounded-xl bg-warning/10 p-3 text-warning">Aplica la migración 0036 para activar el control económico.</p>
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between text-caption">
              <span className="flex items-center gap-1 text-text-tertiary"><DollarSign size={14} /> Consumo del mes</span>
              <span className="font-semibold text-text">US${config.gastadoMesUsd.toFixed(4)} / US${config.presupuestoMensualUsd.toFixed(2)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-vip" style={{ width: `${pct}%` }} /></div>
            <p className="text-micro mt-2 text-text-tertiary">{config.consultasMes} consultas registradas</p>
          </div>
          <form action={accion} className="space-y-3">
            <label className="flex items-center gap-2 text-secondary text-text-secondary">
              <input type="checkbox" name="activo" defaultChecked={config.activo} style={{ accentColor: "var(--color-vip)" }} />
              Permitir consultas con IA
            </label>
            <label className="text-secondary text-text-secondary">
              Presupuesto máximo mensual (USD)
              <Input name="presupuesto" type="number" min={0} max={1000} step={1} defaultValue={config.presupuestoMensualUsd} className="mt-1" />
            </label>
            {estado.mensaje && <p className={`text-caption ${estado.ok ? "text-success" : "text-error"}`}>{estado.mensaje}</p>}
            <Button type="submit" variant="secondary" loading={pendiente}>Guardar límite de IA</Button>
          </form>
        </>
      )}
      <p className="text-micro mt-4 flex items-start gap-2 text-text-tertiary"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" /> Al llegar al límite, la IA se bloquea; reportes, historial y recordatorios continúan gratis.</p>
    </Card>
  );
}

