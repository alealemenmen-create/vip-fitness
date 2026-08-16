"use client";

import { useActionState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cerrarBacklogSeriesSinRegistro, type CerrarBacklogState } from "@/app/admin/auditoria/actions";

const inicial: CerrarBacklogState = { ok: false, error: null, mensaje: null };

/** Cierre en bloque del backlog de "series sin registro" de antes del
 * 11/08 — un solo bug de UX ya corregido, no casos para revisar uno por
 * uno (ver diagnóstico del 2026-08-16). Solo aparece si hay algo que
 * cerrar, para no ocupar espacio una vez que el backlog quedó al día. */
export function CerrarBacklogAuditoria({ pendientes }: { pendientes: number }) {
  const [estado, accion, pendiente] = useActionState(cerrarBacklogSeriesSinRegistro, inicial);
  if (pendientes === 0 && !estado.mensaje) return null;

  return (
    <Card padding="p-4" className="space-y-3 border-warning/35">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <History size={17} />
        </div>
        <div>
          <p className="text-caption font-semibold text-text">
            {pendientes} {pendientes === 1 ? "sesión vieja" : "sesiones viejas"} sin registro
          </p>
          <p className="text-caption text-text-secondary">
            Todas de antes del 11/08, cuando &quot;Completar y guardar&quot; no avisaba que quedaban series sin
            cargar. Es el mismo caso de confusión, ya corregido en la app — no fraude. Cerrarlas en bloque
            en vez de una por una.
          </p>
        </div>
      </div>
      <form action={accion}>
        <Button type="submit" size="xsAuto" className="w-full" loading={pendiente} disabled={pendiente}>
          Cerrar todo el backlog viejo
        </Button>
      </form>
      {estado.error && <p className="text-caption text-error">{estado.error}</p>}
      {estado.mensaje && <p className="text-caption text-success">{estado.mensaje}</p>}
    </Card>
  );
}
