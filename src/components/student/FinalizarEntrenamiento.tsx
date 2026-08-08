"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { finalizarSesion } from "@/app/alumno/entrenar/actions";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";

export function FinalizarEntrenamiento({
  sesionId,
  completados,
  total,
  esDescanso = false,
  compacto = false,
}: {
  sesionId: string;
  completados: number;
  total: number;
  esDescanso?: boolean;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ultimaConfirmacion, setUltimaConfirmacion] = useState(false);
  const pendientes = total - completados;
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0;
  const puntos = calcularPuntosEntrenamiento(completados, total);

  if (!abierto) {
    return (
      <Button variant="accion" size={compacto ? "xs" : "lg"} onClick={() => setAbierto(true)} className="w-full">
        {esDescanso ? "Marcar día como completado" : `Finalizar y sumar +${puntos} pts`}
      </Button>
    );
  }

  if (!ultimaConfirmacion) {
    return (
      <Card className={compacto ? "col-span-2" : ""}>
        <p className="text-card-title text-text">¿Seguro que quieres finalizar?</p>
        {!esDescanso && (
          <p className="text-caption mt-1 text-text-secondary">
            Llevas {completados} de {total} ejercicios ({pct}%).
          </p>
        )}
        {!esDescanso && pendientes > 0 && (
          <p className="text-caption mt-2 text-error">
            Aún tienes {pendientes} {pendientes === 1 ? "ejercicio pendiente" : "ejercicios pendientes"}.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="primary" size="sm" className="flex-1" onClick={() => setUltimaConfirmacion(true)}>
            Sí, continuar
          </Button>
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setAbierto(false)}>
            Volver
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={compacto ? "col-span-2" : ""}>
      <p className="text-card-title text-text">Última confirmación</p>
      <p className="text-caption mt-1 text-text-secondary">Al confirmar, esta sesión quedará finalizada.</p>
      {!esDescanso && (
        <p className="text-body mt-2 text-text">
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
            {puntos > 0 ? `Confirmar +${puntos} pts` : "Confirmar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              setUltimaConfirmacion(false);
              setAbierto(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
