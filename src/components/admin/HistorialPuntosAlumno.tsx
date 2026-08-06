import { Card } from "@/components/ui/Card";
import type { MovimientoPuntos } from "@/lib/ranking/data";

const CATEGORIA_LABEL: Record<MovimientoPuntos["categoria"], string> = {
  entrenamiento: "Entrenamiento",
  alimentacion: "Alimentación",
  progreso: "Progreso",
  constancia: "Constancia",
  competencia: "Competencia",
  ajuste: "Ajuste",
};

/** Ledger completo de Puntos VIP de un alumno, para que el entrenador pueda
 * auditar de dónde salió cada punto (o penalización) en vez de confiar solo
 * en el total. Mismo dato que el alumno ve en `/alumno/ranked`
 * (`obtenerMovimientosAlumno`), acá sin el límite bajo pensado para esa
 * pantalla. */
export function HistorialPuntosAlumno({ movimientos }: { movimientos: MovimientoPuntos[] }) {
  const total = movimientos.reduce((acc, m) => acc + m.puntos, 0);

  return (
    <Card padding="p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] text-text-tertiary">HISTORIAL DE PUNTOS VIP</p>
        <p className={`text-caption font-medium ${total < 0 ? "text-error" : "text-vip"}`}>
          {total > 0 ? "+" : ""}
          {total}
        </p>
      </div>

      {movimientos.length === 0 ? (
        <p className="text-caption text-text-secondary">Todavía no tiene movimientos de puntos.</p>
      ) : (
        <div className="max-h-96 space-y-1.5 overflow-y-auto">
          {movimientos.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 border-t border-border pt-1.5 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="text-caption text-text">{m.titulo}</p>
                <p className="text-[9px] text-text-tertiary">
                  {m.fecha} · {CATEGORIA_LABEL[m.categoria]}
                </p>
                {m.detalle && <p className="text-[9px] mt-0.5 text-text-secondary">{m.detalle}</p>}
              </div>
              <p className={`shrink-0 text-caption font-medium ${m.puntos < 0 ? "text-error" : "text-vip"}`}>
                {m.puntos > 0 ? "+" : ""}
                {m.puntos}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
