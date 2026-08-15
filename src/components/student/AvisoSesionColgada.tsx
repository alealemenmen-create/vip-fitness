"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { abandonarSesion } from "@/app/alumno/entrenar/actions";

/**
 * Sesión "en_progreso" de hace más de un día: no es que el alumno la haya
 * abandonado (no tocó nada), simplemente no volvió — se le fue la batería,
 * cerró la app, lo que sea. El problema real: mientras siga "en_progreso",
 * la pestaña Entrenar SIEMPRE lo manda de vuelta acá (ver BottomNav), así
 * que si hoy quiere arrancar una rutina nueva, primero tiene que enterarse
 * de que hay una vieja en el medio.
 *
 * Encontrado revisando datos reales: 35 de 67 sesiones "en_progreso" en un
 * corte de 14 días llevaban más de 3 días abiertas. Este aviso es la salida:
 * "seguir" (no hace nada, solo cierra el aviso) o "cerrar esta y elegir
 * otra" (abandona la vieja — mismo camino que ya existe en Historial, ver
 * AbandonarSesionBoton — y deja el paso libre para iniciar una rutina
 * nueva).
 */
export function AvisoSesionColgada({ sesionId, dias }: { sesionId: string; dias: number }) {
  const [oculto, setOculto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  if (oculto) return null;

  return (
    <>
      <div className="radius-control mb-2.5 flex items-start gap-2.5 border border-warning/40 bg-warning/10 p-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-warning">
            Esta rutina lleva {dias} {dias === 1 ? "día" : "días"} sin cerrarse
          </p>
          <p className="text-micro mt-0.5 text-text-secondary">
            ¿La seguís ahora o la cerramos para que puedas elegir otra?
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" size="xsAuto" onClick={() => setOculto(true)}>
              Sigo con esta
            </Button>
            <Button type="button" variant="destructive" size="xsAuto" onClick={() => setConfirmando(true)}>
              Cerrar esta rutina
            </Button>
          </div>
        </div>
      </div>

      {confirmando &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <Card padding="p-4" className="w-full max-w-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-medium text-text">¿Cerrar esta rutina sin terminarla?</p>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setConfirmando(false)}
                  className="text-text-tertiary"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-caption text-text-secondary">
                Queda marcada como abandonada y no suma Puntos VIP. Después vas a poder elegir
                cualquier otro día desde Entrenar.
              </p>
              <form action={abandonarSesion} className="flex gap-2">
                <input type="hidden" name="sesion_id" value={sesionId} />
                <Button
                  type="button"
                  variant="secondary"
                  size="xsAuto"
                  className="flex-1"
                  onClick={() => setConfirmando(false)}
                >
                  No, volver
                </Button>
                <Button type="submit" variant="destructive" size="xsAuto" className="flex-1">
                  Sí, cerrar y elegir otra
                </Button>
              </form>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
