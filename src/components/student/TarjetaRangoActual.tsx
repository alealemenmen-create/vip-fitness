import { Card } from "@/components/ui/Card";
import { BadgeRango } from "@/components/student/BadgeRango";
import type { FilaRanking } from "@/lib/ranking/data";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { Crown, Gem, Sparkles } from "lucide-react";

/** Card "Rango de <nombre>": emblema + rango + barra hacia el siguiente
 * rango. Vive sola (antes era la primera card de `ProgresoVipCompetitivo`)
 * para poder ubicarla arriba de Arena VIP en `ranked/page.tsx` — el rango y
 * los puntos acumulados no dependen del periodo (semana/mes/año) que se
 * elija más abajo, por eso alcanza con una sola fila del ranking para
 * armarla.
 *
 * Antes decía "Tu rango actual" a secas — pero esta pantalla también la ve
 * el entrenador "viendo como" un alumno, y sin el nombre de por medio se
 * confunde fácil con el rango de OTRO alumno que recién estaba mirando en
 * otra pantalla (pasó con Diego Cerna, 2026-08-16: parecía que decía Bronce
 * cuando en realidad era el rango propio de Alejandro, no el de Diego). */
export function TarjetaRangoActual({ filas, alumnoId }: { filas: FilaRanking[]; alumnoId: string }) {
  const propia = filas.find((fila) => fila.alumnoId === alumnoId);
  if (!propia) return null;

  const progreso = progresoAlSiguiente(propia.puntosAcumulados);
  const nombre = nombreAlumnoPublicado(propia.nombre);

  return (
    <Card className="ranked-diamond-card efecto-3d overflow-hidden" padding="p-5">
      <span className="ranked-diamond-facet ranked-diamond-facet--one" aria-hidden />
      <span className="ranked-diamond-facet ranked-diamond-facet--two" aria-hidden />
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="ranked-rango-badge">
          <BadgeRango rango={propia.rango} size={100} destacado eager />
          <span><Crown size={12} /> Insignia de {nombre}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="ranked-casino-kicker truncate"><Gem size={12} /> Rango de {nombre}</p>
          <p className="text-h2" style={{ color: propia.rango.color }}>{propia.rango.nombre}</p>
          <div className="ranked-jackpot-total">
            <span>{propia.puntosAcumulados.toLocaleString("es-CL")}</span>
            <small>Puntos VIP</small>
          </div>
        </div>
      </div>

      {progreso ? (
        <div className="relative mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="text-caption text-text-secondary">
              Próximo rango: <span className="font-semibold" style={{ color: progreso.siguiente.color }}>{progreso.siguiente.nombre}</span>
            </p>
            <p className="text-caption font-bold text-vip">{progreso.faltan.toLocaleString("es-CL")} para subir</p>
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
        <p className="relative mt-3 flex items-center gap-1.5 text-caption font-semibold text-vip"><Sparkles size={14} /> Alcanzaste el rango máximo.</p>
      )}
    </Card>
  );
}
