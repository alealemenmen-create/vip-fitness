"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { CONSEJOS_ENTRENAMIENTO } from "@/lib/frasesMotivacionales";

/** Cada cuánto cambia el consejo. Dos minutos: con 10 segundos el texto se
 * movía todo el tiempo abajo de la vista y distraía en medio de una serie.
 * A este ritmo, en un entrenamiento de 45 minutos se ven ~22 consejos y no
 * alcanza a repetirse ninguno (la lista tiene 28). */
const CADA_MS = 120_000;

/**
 * Consejo de entrenamiento fijo al pie de la sesión, justo arriba de la barra
 * de navegación. Va acá y no en la lista de días porque es donde el alumno
 * pasa el rato: entre serie y serie mira la pantalla, y ese es el momento de
 * decirle algo útil sobre cómo entrenar.
 *
 * `inicial` viene del servidor para que la primera pintada coincida con la del
 * navegador (si empezara en un índice al azar habría desajuste de hidratación).
 * A partir de ahí rota solo.
 */
export function ConsejoEntrenamiento({ inicial }: { inicial: number }) {
  const [indice, setIndice] = useState(inicial);

  useEffect(() => {
    const id = setInterval(
      () => setIndice((n) => (n + 1) % CONSEJOS_ENTRENAMIENTO.length),
      CADA_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    // Va en el flujo, al final de la lista, y NO flotando sobre la pantalla:
    // fijo abajo tapaba permanentemente unos 60 px de la tarjeta del ejercicio
    // en curso, que es justo lo que hacía que no entraran de una el ejercicio
    // activo y la cabecera del siguiente. Es un consejo, no una alerta: puede
    // esperar a que el alumno llegue al final.
    <div className="radius-control flex items-start gap-2 border border-border bg-surface px-3 py-2">
      <Zap size={14} className="mt-0.5 shrink-0 text-vip" fill="currentColor" />
      <div className="min-w-0">
        <p className="text-micro font-semibold tracking-wide text-vip">TIP DEL DÍA</p>
        {/* El `key` es lo que reinicia la animación en cada cambio: sin él,
            React reusa el mismo nodo y el texto se reemplaza de golpe. */}
        <p
          key={indice}
          aria-live="off"
          className="text-caption animate-[aparecer-consejo_500ms_ease-out] text-text-secondary motion-reduce:animate-none"
        >
          {CONSEJOS_ENTRENAMIENTO[indice]}
        </p>
      </div>
    </div>
  );
}
