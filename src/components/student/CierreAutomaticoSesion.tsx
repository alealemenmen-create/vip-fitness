"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { finalizarSesion } from "@/app/alumno/entrenar/actions";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";

/**
 * Terminó todos los ejercicios: se le pone el cierre adelante, sin que tenga
 * que buscarlo.
 *
 * El pedido fue "que lo más lógico sea automático". Cerrar del todo solo, sin
 * preguntar, no se hace a propósito: acreditar puntos es irreversible desde el
 * lado del alumno y hay gente que después de la última serie todavía anota
 * kilos o corrige una repetición. Lo que sí se puede automatizar es que la
 * decisión APAREZCA sola, grande y en el momento exacto, en vez de esperar a
 * que el alumno baje hasta el final de la pantalla y encuentre un botón.
 *
 * Aparece una sola vez. Si la cierra ("Todavía no"), el botón de finalizar
 * sigue donde siempre — no se le vuelve a tapar la pantalla.
 */
export function CierreAutomaticoSesion({
  sesionId,
  total,
}: {
  sesionId: string;
  total: number;
}) {
  const [descartado, setDescartado] = useState(false);
  const puntos = calcularPuntosEntrenamiento(total, total);

  if (descartado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/80 px-4 backdrop-blur-md">
      <Card padding="p-5" className="w-full max-w-sm space-y-3 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-vip/15 text-vip">
          <Trophy size={28} />
        </span>
        <div>
          <p className="text-card-title text-text">¡Terminaste los {total} ejercicios!</p>
          <p className="text-caption mt-1 text-text-secondary">
            Solo falta cerrar la rutina para que se sumen tus Puntos VIP. Si sales sin
            cerrarla, la sesión queda abierta y no puntúa.
          </p>
        </div>
        <form action={finalizarSesion} className="space-y-2">
          <input type="hidden" name="sesion_id" value={sesionId} />
          <Button type="submit" variant="accion" size="lg" className="w-full">
            Cerrar y sumar +{puntos} pts
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setDescartado(true)}
          className="text-caption min-h-10 w-full text-text-tertiary underline"
        >
          Todavía no, quiero revisar mis registros
        </button>
      </Card>
    </div>,
    document.body
  );
}
