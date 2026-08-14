"use client";

import { useState, useTransition } from "react";
import { Timer, TriangleAlert } from "lucide-react";
import {
  actualizarSegundosDescansoPreferido,
  actualizarTemporizadorDescansoAlumno,
} from "@/app/alumno/perfil/actions";
import { Card } from "@/components/ui/Card";

const OPCIONES_SEGUNDOS = [45, 60, 90, 120, 150] as const;

export function TemporizadorDescansoToggle({
  activoInicial,
  segundosPreferidoInicial,
}: {
  activoInicial: boolean;
  segundosPreferidoInicial: number | null;
}) {
  const [activo, setActivo] = useState(activoInicial);
  const [segundos, setSegundos] = useState<number | null>(segundosPreferidoInicial);
  const [confirmando, setConfirmando] = useState(false);
  const [pending, iniciar] = useTransition();

  const guardar = (nuevoValor: boolean) => {
    setActivo(nuevoValor);
    setConfirmando(false);
    iniciar(() => actualizarTemporizadorDescansoAlumno(nuevoValor));
  };

  const elegirSegundos = (valor: number | null) => {
    setSegundos(valor);
    iniciar(() => actualizarSegundosDescansoPreferido(valor));
  };

  return (
    <Card padding="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-vip" />
          <div>
            <p className="text-caption font-semibold text-text">Temporizador de descanso</p>
            <p className="text-micro text-text-tertiary">
              {activo ? "Activado — ganas los puntos completos al terminar" : "Apagado por ti"}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          disabled={pending}
          onClick={() => (activo ? setConfirmando(true) : guardar(true))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            activo ? "bg-vip" : "bg-surface-2"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
              activo ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {confirmando && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
          <p className="flex items-center gap-1.5 text-micro font-bold text-warning">
            <TriangleAlert size={13} /> Vas a ganar menos puntos
          </p>
          <p className="mt-1 text-micro leading-relaxed text-text-secondary">
            Si terminas una sesión con el temporizador apagado, en vez de hasta +300 puntos por
            &quot;Entrenamiento finalizado&quot; recibes -50. Puedes volver a activarlo cuando quieras.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => guardar(false)}
              className="min-h-9 flex-1 rounded-xl border border-warning/40 text-micro font-bold text-warning"
            >
              Apagarlo igual
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="min-h-9 flex-1 rounded-xl bg-surface-2 text-micro font-bold text-text-secondary"
            >
              Dejarlo activado
            </button>
          </div>
        </div>
      )}

      {activo && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-micro font-semibold text-text-tertiary">Controla tu descanso</p>
          <p className="mt-0.5 text-micro text-text-secondary">
            Elige cuántos segundos quieres descansar entre series — reemplaza lo que programó tu
            entrenador en todos tus ejercicios.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => elegirSegundos(null)}
              className={`min-h-8 rounded-full border px-3 text-micro font-bold disabled:opacity-50 ${
                segundos === null
                  ? "border-vip bg-vip/15 text-vip"
                  : "border-border text-text-secondary"
              }`}
            >
              Programado por tu entrenador
            </button>
            {OPCIONES_SEGUNDOS.map((opcion) => (
              <button
                key={opcion}
                type="button"
                disabled={pending}
                onClick={() => elegirSegundos(opcion)}
                className={`min-h-8 rounded-full border px-3 text-micro font-bold disabled:opacity-50 ${
                  segundos === opcion
                    ? "border-vip bg-vip/15 text-vip"
                    : "border-border text-text-secondary"
                }`}
              >
                {opcion}s
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
