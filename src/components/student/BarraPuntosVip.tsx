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
    <div className="radius-control border border-vip/25 bg-vip/5 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <Zap size={13} className="text-vip" fill="currentColor" />
        <p className="text-micro flex-1 font-semibold uppercase tracking-wide text-text-secondary">{etiqueta}</p>
        <p className="text-caption font-bold text-vip">+{puntos}/{maximo} pts</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="barra-progreso-relleno h-full rounded-full bg-vip transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {ayuda && <p className="mt-1 text-[9px] leading-tight text-text-tertiary">{ayuda}</p>}
    </div>
  );
}
