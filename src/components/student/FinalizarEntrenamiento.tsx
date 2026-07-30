"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { finalizarSesion } from "@/app/alumno/entrenar/actions";

export function FinalizarEntrenamiento({
  sesionId,
  completados,
  total,
  esDescanso = false,
}: {
  sesionId: string;
  completados: number;
  total: number;
  esDescanso?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const pendientes = total - completados;
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0;

  if (!abierto) {
    return (
      <Button variant="secondary" onClick={() => setAbierto(true)}>
        {esDescanso ? "Marcar día como completado" : "Finalizar entrenamiento"}
      </Button>
    );
  }

  return (
    <Card>
      {!esDescanso && (
        <p className="text-body text-text">
          {completados} de {total} ejercicios completados ({pct}%)
        </p>
      )}
      {!esDescanso && pendientes > 0 && (
        <p className="text-secondary mt-1 text-error">
          Tienes {pendientes} ejercicios pendientes. ¿Deseas finalizar igualmente?
        </p>
      )}
      <form action={finalizarSesion} className="mt-4 space-y-3">
        <input type="hidden" name="sesion_id" value={sesionId} />
        <Textarea
          name="comentario"
          rows={2}
          placeholder={esDescanso ? "¿Qué hiciste hoy? (opcional)" : "Comentario opcional"}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" className="flex-1">
            Confirmar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
