"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
    // A 100 px del borde queda despegado de los íconos, igual que el buscador
    // de Nutrición. Fondo ámbar sólido —el color de acento del tema— con texto
    // negro: es el mismo contraste del botón principal, y a esta altura de la
    // pantalla tiene que saltar a la vista sobre las tarjetas oscuras.
    <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-30 mx-auto w-full max-w-md px-4">
      <div className="radius-control flex items-center gap-1.5 bg-vip px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)]">
        <Sparkles size={12} className="shrink-0 text-black" />
        {/* El `key` es lo que reinicia la animación en cada cambio: sin él,
            React reusa el mismo nodo y el texto se reemplaza de golpe. */}
        <p
          key={indice}
          aria-live="off"
          className="text-micro animate-[aparecer-consejo_500ms_ease-out] font-semibold text-black motion-reduce:animate-none"
        >
          {CONSEJOS_ENTRENAMIENTO[indice]}
        </p>
      </div>
    </div>
  );
}
