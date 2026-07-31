"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { aprobarAlimento, rechazarAlimento } from "@/app/admin/alimentos/actions";
import type { AlimentoAdmin } from "@/components/admin/AlimentosManager";

export type AlimentoPendiente = AlimentoAdmin & { autor: string };

/**
 * Los alimentos que crearon los alumnos desde Comer y todavía no entran al
 * catálogo del gimnasio. El alumno ya los está usando en su propio diario: acá
 * se decide si los ve el resto (Aceptar) o no (Rechazar, que solo los
 * desactiva — ver `rechazarAlimento`).
 */
export function AlimentosPendientes({ alimentos }: { alimentos: AlimentoPendiente[] }) {
  const [pendiente, setPendiente] = useState(alimentos);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const resolver = (id: string, accion: (id: string) => Promise<void>) => {
    setEnCurso(id);
    startTransition(async () => {
      await accion(id);
      // Se saca de la lista al confirmar el servidor; el revalidatePath de la
      // acción lo quitaría igual, pero recién en la próxima navegación.
      setPendiente((previos) => previos.filter((a) => a.id !== id));
      setEnCurso(null);
    });
  };

  if (pendiente.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-card-title text-text">Esperando aprobación</h2>
        <Pill tone="vip">{pendiente.length}</Pill>
      </div>
      <p className="text-caption text-text-tertiary">
        Alimentos que crearon los alumnos. Hasta que los aceptes, solo los ve quien los creó.
      </p>

      {pendiente.map((a) => (
        <Card key={a.id} className="space-y-3">
          <div>
            <p className="text-body text-text">{a.nombre}</p>
            <p className="text-caption text-text-tertiary">
              {a.kcal} kcal · P{a.prot} C{a.carb} G{a.grasa} /{a.porcionBase}
              {a.unidad}
            </p>
            <p className="text-caption mt-1 text-text-secondary">Lo creó {a.autor}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="success"
              size="sm"
              className="flex-1"
              disabled={enCurso === a.id}
              onClick={() => resolver(a.id, aprobarAlimento)}
            >
              <Check size={16} /> Aceptar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              disabled={enCurso === a.id}
              onClick={() => resolver(a.id, rechazarAlimento)}
            >
              <X size={16} /> Rechazar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
