import { RANGOS } from "@/lib/ranking/puntos";
import { BadgeRango } from "./BadgeRango";

/** Escala compacta: conserva las siete medallas sin convertirlas en una lista larga. */
export function EscalaRangos({ rangoActual }: { rangoActual?: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {RANGOS.map((rango) => {
        const esActual = rango.nombre === rangoActual;
        return (
          <div
            key={rango.nombre}
            className="radius-control flex min-w-[58px] flex-1 flex-col items-center px-1 py-1.5 text-center"
            style={{
              background: esActual ? `${rango.color}22` : "transparent",
              border: esActual ? `1px solid ${rango.color}` : "1px solid transparent",
            }}
          >
            <BadgeRango rango={rango} size={30} destacado={esActual} />
            <p
              className="mt-1 max-w-[55px] truncate text-[8px] font-bold uppercase"
              style={{ color: rango.color }}
            >
              {rango.nombre}
            </p>
            <p className="text-[7px] tabular-nums text-text-tertiary">
              {rango.desde >= 1000 ? `${rango.desde / 1000}k` : rango.desde}
            </p>
          </div>
        );
      })}
    </div>
  );
}
