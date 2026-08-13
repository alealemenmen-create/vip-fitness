"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { iniciarRutina } from "@/app/alumno/entrenar/actions";

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
 * `document` ahí) — mismo patrón que el resto de la app para todo lo que
 * depende del DOM real.
 */
export function BotonIniciarRutinaFijo({ sesionId }: { sesionId: string }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-[var(--alto-nav-alumno,110px)] z-30 mx-auto w-full max-w-md px-4 pb-2">
      <form action={iniciarRutina}>
        <input type="hidden" name="sesion_id" value={sesionId} />
        <button
          type="submit"
          className="btn-accion boton-entrenar-pulso radius-control flex h-16 w-full items-center justify-center gap-2 text-body font-bold"
        >
          <Play size={20} strokeWidth={3} /> Iniciar rutina
        </button>
      </form>
    </div>,
    document.body
  );
}
