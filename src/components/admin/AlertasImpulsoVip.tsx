import { AlertTriangle, HeartCrack, TrendingDown } from "lucide-react";
import { resolverAlertaImpulso } from "@/app/admin/alumnos/impulso-actions";
import type { AlertaPendiente } from "@/lib/impulso-vip/data";

const CONFIG_TIPO = {
  dolor: { Icon: HeartCrack, etiqueta: "Molestia reportada" },
  estancamiento_3_sesiones: { Icon: AlertTriangle, etiqueta: "3 sesiones sin progresar" },
  caida_rendimiento: { Icon: TrendingDown, etiqueta: "Caída de rendimiento" },
} as const;

const ETIQUETAS_MOMENTO: Record<string, string> = {
  antes: "Antes del ejercicio",
  durante: "Durante el ejercicio",
  despues: "Después del ejercicio",
};

/**
 * Panel mínimo de Impulso VIP para la ficha del alumno — Fase 1: solo
 * alertas activas de este alumno puntual, sin página global ni cola de
 * recomendaciones pendientes de aprobación todavía (eso queda para más
 * adelante, ver AGENTS del proyecto).
 */
export function AlertasImpulsoVip({ alumnoId, alertas }: { alumnoId: string; alertas: AlertaPendiente[] }) {
  if (alertas.length === 0) return null;

  return (
    <div className="radius-card border border-warning/40 bg-warning/5 p-2">
      <p className="text-[10px] mb-1.5 font-semibold text-warning">
        IMPULSO VIP · {alertas.length} {alertas.length === 1 ? "ALERTA" : "ALERTAS"}
      </p>
      <div className="space-y-1.5">
        {alertas.map((alerta) => {
          const { Icon, etiqueta } = CONFIG_TIPO[alerta.tipo];
          return (
            <div key={alerta.id} className="radius-control border border-border bg-surface-2 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <Icon size={14} className="mt-0.5 shrink-0 text-warning" strokeWidth={2.25} />
                  <div>
                    <p className="text-caption font-semibold text-text">{etiqueta}</p>
                    <p className="text-micro text-text-tertiary">{alerta.ejercicioNombre}</p>
                    {alerta.tipo === "dolor" && (
                      <p className="text-micro mt-0.5 text-text-secondary">
                        {[
                          alerta.zona && `Zona: ${alerta.zona}`,
                          alerta.intensidad && `Intensidad ${alerta.intensidad}/5`,
                          alerta.momento && ETIQUETAS_MOMENTO[alerta.momento],
                          alerta.detuvoEjercicio && "Tuvo que parar el ejercicio",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin más detalle"}
                      </p>
                    )}
                    {alerta.detalle && <p className="text-micro mt-0.5 text-text-secondary">{alerta.detalle}</p>}
                  </div>
                </div>
                <form action={resolverAlertaImpulso}>
                  <input type="hidden" name="alerta_id" value={alerta.id} />
                  <input type="hidden" name="alumno_id" value={alumnoId} />
                  <button
                    type="submit"
                    className="text-micro shrink-0 rounded-full border border-border px-2 py-1 text-text-secondary"
                  >
                    Resuelta
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
