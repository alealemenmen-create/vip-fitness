import { Card } from "@/components/ui/Card";
import { BadgeRango } from "@/components/student/BadgeRango";
import type { FilaRanking } from "@/lib/ranking/data";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";

/** Card "Tu rango actual": emblema + rango + barra hacia el siguiente rango.
 * Vive sola (antes era la primera card de `ProgresoVipCompetitivo`) para
 * poder ubicarla arriba de Arena VIP en `ranked/page.tsx` — el rango y los
 * puntos acumulados no dependen del periodo (semana/mes/año) que se elija
 * más abajo, por eso alcanza con una sola fila del ranking para armarla. */
export function TarjetaRangoActual({ filas, alumnoId }: { filas: FilaRanking[]; alumnoId: string }) {
  const propia = filas.find((fila) => fila.alumnoId === alumnoId);
  if (!propia) return null;

  const progreso = progresoAlSiguiente(propia.puntosAcumulados);

  return (
    <Card className="efecto-3d overflow-hidden">
      <div className="flex items-center gap-4">
        <BadgeRango rango={propia.rango} size={104} destacado eager />
        <div className="min-w-0 flex-1">
          <p className="text-micro uppercase tracking-[0.18em] text-text-tertiary">Tu rango actual</p>
          <p className="text-h2" style={{ color: propia.rango.color }}>{propia.rango.nombre}</p>
          <p className="text-secondary text-text-secondary">
            {propia.puntosAcumulados.toLocaleString("es-CL")} Puntos VIP totales
          </p>
        </div>
      </div>

      {progreso ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-caption text-text-secondary">
              Próximo rango: <span className="font-semibold" style={{ color: progreso.siguiente.color }}>{progreso.siguiente.nombre}</span>
            </p>
            <p className="text-caption font-bold text-vip">faltan {progreso.faltan.toLocaleString("es-CL")}</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div
              className="barra-progreso-relleno h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${progreso.pct}%`,
                background: `linear-gradient(90deg, ${propia.rango.color}, ${progreso.siguiente.color})`,
              }}
            >
              {[0, 1, 2, 3].map((indice) => (
                <span key={indice} className="ola-progreso" style={{ animationDelay: `${indice * 0.52}s` }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-caption mt-3 font-semibold text-vip">Alcanzaste el rango máximo.</p>
      )}
    </Card>
  );
}
