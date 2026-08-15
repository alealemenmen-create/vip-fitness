import { CheckCircle2, Circle, MinusCircle, ShieldAlert, XCircle } from "lucide-react";
import type { ResultadoHistorialImpulso } from "@/lib/impulso-vip/historial-data";

const NOMBRE_TECNICA = {
  cierre_controlado: "Cierre controlado",
  repeticion_objetivo: "Repetición objetivo",
  tempo_controlado: "Tempo controlado",
  pausa_isometrica: "Pausa isométrica",
  serie_descarga: "Serie de descarga",
  drop_set: "Drop set",
  rest_pause: "Rest-pause",
  fallo_controlado: "Fallo técnico",
};

const RESULTADO = {
  lograda: { texto: "Completó el objetivo", icono: CheckCircle2, clase: "text-success" },
  parcial: { texto: "Quedó corto", icono: MinusCircle, clase: "text-warning" },
  no_lograda: { texto: "No logró el objetivo", icono: XCircle, clase: "text-error" },
  omitida: { texto: "No hizo la técnica", icono: Circle, clase: "text-text-tertiary" },
  omitida_molestia: { texto: "La detuvo por molestia", icono: ShieldAlert, clase: "text-error" },
};

function formatoHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorialImpulsoVIP({ historial }: { historial: ResultadoHistorialImpulso[] }) {
  if (historial.length === 0) return null;
  return (
    <section className="admin-panel-card rounded-3xl p-4" aria-label="Historial de resultados de Impulso VIP">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-text">Resultados de Impulso</h2>
        <p className="text-[11px] text-text-tertiary">Cómo le fue a cada alumno en su último Momento Impulso</p>
      </div>
      <div className="space-y-2">
        {historial.map((fila) => {
          const info = RESULTADO[fila.resultado];
          const Icono = info.icono;
          return (
            <article key={fila.id} className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface-2 p-3">
              <Icono size={16} className={`mt-0.5 shrink-0 ${info.clase}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-text">{fila.alumno}</p>
                <p className="truncate text-[11px] text-text-secondary">{fila.ejercicio} · {NOMBRE_TECNICA[fila.tipo]}</p>
                <p className={`mt-0.5 text-[11px] font-semibold ${info.clase}`}>{info.texto}</p>
              </div>
              <span className="shrink-0 text-[10px] text-text-tertiary">{formatoHora(fila.resueltaEn)}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
