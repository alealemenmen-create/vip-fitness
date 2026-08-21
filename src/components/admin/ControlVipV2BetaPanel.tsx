"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { actualizarAccesoControlVipV2 } from "@/app/admin/configuracion/actions";
import type { FormState } from "@/app/admin/alumnos/actions";
import type { CuentaBetaControlVipV2 } from "@/lib/control-vip-v2/beta";
import { Card } from "@/components/ui/Card";

const inicial: FormState = { error: null, ok: false };

function FilaCuentaBeta({ cuenta }: { cuenta: CuentaBetaControlVipV2 }) {
  const [estado, accion, pendiente] = useActionState(actualizarAccesoControlVipV2, inicial);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{cuenta.nombre}</p>
        <p className="text-caption text-text-tertiary">{cuenta.rol === "admin" ? "Administrador" : "Entrenador"}</p>
        {estado.error ? <p role="alert" className="mt-1 text-caption text-error">{estado.error}</p> : null}
      </div>
      <form action={accion}>
        <input type="hidden" name="cuenta_id" value={cuenta.id} />
        <input type="hidden" name="habilitado" value={cuenta.habilitado ? "false" : "true"} />
        <button
          type="submit"
          disabled={pendiente}
          className="radius-control flex min-h-9 shrink-0 items-center gap-1.5 border border-emerald-300/30 px-3 text-caption font-semibold text-emerald-200 disabled:opacity-50"
        >
          <ShieldCheck size={14} />
          {pendiente ? "Guardando…" : cuenta.habilitado ? "Retirar" : "Habilitar"}
        </button>
      </form>
    </div>
  );
}

/** Fase 0 de docs/PROYECTO_CONTROL_VIP_V2.md: quién puede probar /control-vip. */
export function ControlVipV2BetaPanel({ cuentas }: { cuentas: CuentaBetaControlVipV2[] }) {
  if (cuentas.length === 0) {
    return <p className="text-caption text-text-tertiary">No hay cuentas de entrenador o administrador registradas.</p>;
  }

  return (
    <Card padding="p-3">
      {cuentas.map((cuenta) => (
        <FilaCuentaBeta key={cuenta.id} cuenta={cuenta} />
      ))}
    </Card>
  );
}
