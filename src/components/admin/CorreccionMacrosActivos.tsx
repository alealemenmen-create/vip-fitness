"use client";

import { useActionState } from "react";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { corregirMacrosActivos, type CorreccionMacrosState } from "@/app/admin/auditoria/actions";

const inicial: CorreccionMacrosState = { ok: false, error: null, mensaje: null };

export function CorreccionMacrosActivos() {
  const [estado, accion, pendiente] = useActionState(corregirMacrosActivos, inicial);
  return (
    <Card padding="p-4" className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vip/10 text-vip">
          <Calculator size={17} />
        </div>
        <div>
          <p className="text-caption font-semibold text-text">Coherencia de calorías y macros</p>
          <p className="text-caption text-text-secondary">
            Revisa todos los planes activos y ajusta carbohidratos cuando los cuatro objetivos no cierran.
          </p>
        </div>
      </div>
      <form action={accion}>
        <Button type="submit" size="xsAuto" className="w-full" loading={pendiente} disabled={pendiente}>
          Revisar y corregir todos
        </Button>
      </form>
      {estado.error && <p className="text-caption text-error">{estado.error}</p>}
      {estado.mensaje && <p className="text-caption text-success">{estado.mensaje}</p>}
    </Card>
  );
}
