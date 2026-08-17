"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Play } from "lucide-react";
import { iniciarRutina, cancelarOtraYIniciarRutina } from "@/app/alumno/entrenar/actions";
import type { ConflictoSesionActiva } from "@/app/alumno/entrenar/data";

/**
 * "Iniciar rutina", fijo justo encima de la barra de navegación, sin
 * moverse mientras se scrollea la lista de ejercicios. Pedido de Alejandro:
 * con varios ejercicios en pantalla el botón quedaba perdido en el medio de
 * la lista y había que scrollear para encontrarlo.
 *
 * Va por portal a `document.body` a propósito: la pantalla de alumno
 * scrollea DENTRO de `.pantalla-scroll`, que tiene un `transform` fijo aplicado
 * a propósito (fix de repintado de iOS Safari, ver globals.css). Cualquier
 * `position: fixed` DESCENDIENTE de un elemento con `transform` deja de ser
 * fijo respecto a la pantalla real y pasa a ser fijo respecto a ESE
 * contenedor — que es justo el que se mueve al scrollear. El botón quedaba
 * "fijo" pero relativo a la lista, subiendo y bajando con ella. El modal de
 * técnica de esta misma pantalla ya resuelve el mismo problema así.
 *
 * `montado` evita el portal en el primer render del servidor (no existe
 * `document` ahí) — mismo patrón que el resto de la app (`useSyncExternalStore`
 * con un "store" que nunca cambia, en vez de `setState` dentro de un efecto).
 */
const suscribirSinCambios = () => () => {};

export function BotonIniciarRutinaFijo({
  sesionId,
  conflicto,
}: {
  sesionId: string;
  /** Otra sesión en curso de verdad, si existe (ver
   * `obtenerConflictoSesionActiva`). Antes este botón, a diferencia del
   * calendario, redirigía en silencio a esa otra sesión sin avisar —
   * alumnos terminaban arrancando la rutina equivocada sin darse cuenta.
   * Pedido de Alejandro, 2026-08-17: avisar CUÁL sesión sigue en curso y
   * pedir confirmación DOS veces antes de abandonarla. */
  conflicto: ConflictoSesionActiva | null;
}) {
  const montado = useSyncExternalStore(suscribirSinCambios, () => true, () => false);
  // paso 0: cerrado. paso 1: "tenés otra sesión activa, ¿continuar o cambiar?".
  // paso 2: "¿seguro? se abandona y no se puede deshacer" — la confirmación
  // extra que pidió Alejandro para esta acción, que no tiene vuelta atrás.
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  if (!montado) return null;

  return createPortal(
    <>
      <div className="fixed inset-x-0 bottom-[var(--alto-nav-alumno,110px)] z-30 mx-auto w-full max-w-md px-4 pb-2">
        <form
          action={iniciarRutina}
          onSubmit={(e) => {
            if (conflicto) {
              e.preventDefault();
              setPaso(1);
            }
          }}
        >
          <input type="hidden" name="sesion_id" value={sesionId} />
          <button
            type="submit"
            className="btn-accion boton-entrenar-pulso radius-control flex h-16 w-full items-center justify-center gap-2 text-body font-bold"
          >
            <Play size={20} strokeWidth={3} /> Iniciar rutina
          </button>
        </form>
      </div>

      {paso > 0 &&
        conflicto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setPaso(0)}
          >
            <div className="radius-card w-full max-w-sm space-y-3 bg-surface p-4" onClick={(e) => e.stopPropagation()}>
              {paso === 1 ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-vip" />
                    <div>
                      <p className="text-body font-medium text-text">Tienes un entrenamiento activo</p>
                      <p className="text-caption mt-1 text-text-secondary">
                        {conflicto.numeroCalendario ? `La sesión ${conflicto.numeroCalendario}` : "Otra sesión"}
                        {conflicto.diaNombre ? ` (${conflicto.diaNombre})` : ""} sigue en curso. ¿Quieres continuar
                        ese, o cancelarlo para empezar este?
                      </p>
                    </div>
                  </div>

                  <a
                    href={`/alumno/entrenar/sesion/${conflicto.id}`}
                    className="btn-accion radius-control flex h-12 w-full items-center justify-center text-body font-semibold"
                  >
                    Continuar el activo
                  </a>

                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="radius-control flex h-12 w-full items-center justify-center border border-error/50 text-body font-medium text-error"
                  >
                    Cancelar ese y empezar este
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaso(0)}
                    className="radius-control flex h-11 w-full items-center justify-center text-caption font-medium text-text-tertiary"
                  >
                    Volver
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
                    <div>
                      <p className="text-body font-medium text-text">¿Confirmas que quieres abandonarla?</p>
                      <p className="text-caption mt-1 text-text-secondary">
                        {conflicto.numeroCalendario ? `La sesión ${conflicto.numeroCalendario}` : "Esa sesión"} va a
                        quedar abandonada. Esto no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <form action={cancelarOtraYIniciarRutina}>
                    <input type="hidden" name="sesion_id" value={sesionId} />
                    <input type="hidden" name="sesion_id_cancelar" value={conflicto.id} />
                    <button
                      type="submit"
                      className="radius-control flex h-12 w-full items-center justify-center bg-error text-body font-semibold text-white"
                    >
                      Sí, abandonarla y empezar esta
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    className="radius-control flex h-11 w-full items-center justify-center text-caption font-medium text-text-tertiary"
                  >
                    No, volver
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>,
    document.body
  );
}
