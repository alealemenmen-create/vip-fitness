import { Zap } from "lucide-react";

export function BarraPuntosVip({
  puntos,
  maximo,
  etiqueta,
  ayuda,
}: {
  puntos: number;
  maximo: number;
  etiqueta: string;
  ayuda?: string;
}) {
  const pct = maximo > 0 ? Math.max(0, Math.min(100, Math.round((puntos / maximo) * 100))) : 0;
  return (
    <div
      className="radius-control border border-vip/25 bg-vip/5 px-3 py-1"
      title={ayuda}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Zap size={12} className="text-vip" fill="currentColor" />
        <p className="min-w-0 flex-1 truncate whitespace-nowrap text-[9px] font-semibold uppercase leading-none tracking-wide text-text-secondary">{etiqueta}</p>
        <p className="text-caption font-bold text-vip">{puntos >= 0 ? "+" : ""}{puntos}/{maximo} pts</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="barra-progreso-relleno h-full rounded-full bg-vip transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        >
          {[0, 1, 2, 3].map((indice) => (
            <span
              key={indice}
              className="ola-progreso"
              style={{ animationDelay: `${indice * 0.52}s` }}
            />
          ))}
        </div>
      </div>
      {ayuda && <p className="sr-only">{ayuda}</p>}
    </div>
  );
}
