"use client";

import { useActionState } from "react";
import { PanelsTopLeft, ShieldCheck } from "lucide-react";
import { actualizarAccesoPortalV2, type FormState } from "@/app/admin/alumnos/actions";
import { Card } from "@/components/ui/Card";

const inicial: FormState = { error: null, ok: false };

export function AccesoPortalV2Alumno({ alumnoId, habilitado }: { alumnoId: string; habilitado: boolean }) {
  const [estado, accion, pendiente] = useActionState(actualizarAccesoPortalV2, inicial);

  return (
    <Card padding="p-3" className="border border-emerald-400/20 bg-emerald-400/[0.04]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <PanelsTopLeft size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Piloto controlado</p>
          <p className="mt-1 text-sm font-semibold text-text">Portal VIP V2</p>
          <p className="mt-1 text-caption leading-relaxed text-text-secondary">
            {habilitado
              ? "Este alumno puede entrar a V2 desde su menú. La Vista clásica permanece disponible."
              : "Este alumno continúa únicamente en la Vista clásica hasta que autorices su prueba."}
          </p>
          <form action={accion} className="mt-3">
            <input type="hidden" name="alumno_id" value={alumnoId} />
            <input type="hidden" name="habilitado" value={habilitado ? "false" : "true"} />
            <button
              type="submit"
              disabled={pendiente}
              className="radius-control flex min-h-10 items-center justify-center gap-2 border border-emerald-300/30 px-4 text-caption font-semibold text-emerald-200 disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              {pendiente ? "Guardando…" : habilitado ? "Retirar acceso a V2" : "Autorizar acceso a V2"}
            </button>
          </form>
          {estado.error ? <p role="alert" className="mt-2 text-caption text-error">{estado.error}</p> : null}
          {estado.ok ? <p role="status" className="mt-2 text-caption text-emerald-300">Acceso actualizado correctamente.</p> : null}
        </div>
      </div>
    </Card>
  );
}
