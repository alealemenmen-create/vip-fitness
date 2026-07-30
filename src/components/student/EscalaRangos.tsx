import { RANGOS } from "@/lib/ranking/puntos";
import { BadgeRango } from "./BadgeRango";

/**
 * Los 7 rangos del más alto al más bajo, con su badge y el puntaje que hay que
 * alcanzar. Va al pie de los torneos para que el alumno vea a qué está
 * jugando: sin la escala a la vista, ganar puntos no significa nada.
 */
export function EscalaRangos({ rangoActual }: { rangoActual?: string }) {
  const deMayorAMenor = [...RANGOS].reverse();

  return (
    <div className="space-y-1.5">
      {deMayorAMenor.map((rango, i) => {
        const esActual = rango.nombre === rangoActual;
        // El de arriba (Olympian) se ve más grande y va bajando.
        const size = 52 - i * 4;

        return (
          <div
            key={rango.nombre}
            className="radius-control flex items-center gap-3 px-2 py-1.5"
            style={{
              background: esActual ? `${rango.color}22` : "transparent",
              border: esActual ? `1px solid ${rango.color}` : "1px solid transparent",
            }}
          >
            <BadgeRango rango={rango} size={size} destacado={esActual} />

            <div className="min-w-0 flex-1">
              <p
                className="text-body font-semibold uppercase tracking-wide"
                style={{ color: rango.color }}
              >
                {rango.nombre}
              </p>
              <p className="text-caption text-text-tertiary">
                {rango.desde === 0
                  ? "desde 0 pts"
                  : `desde ${rango.desde.toLocaleString("es-CL")} pts`}
              </p>
            </div>

            {esActual && (
              <span
                className="text-caption shrink-0 font-bold uppercase"
                style={{ color: rango.color }}
              >
                Estás aquí
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
