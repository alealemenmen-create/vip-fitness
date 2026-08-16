import type { ReactNode } from "react";
import { Calendar, Utensils } from "lucide-react";
import type { BalanceSesionesMes } from "@/app/alumno/entrenar/data";

function LineasDecorativas({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-5 -top-7 opacity-20"
      width="142"
      height="116"
      viewBox="0 0 142 116"
      fill="none"
    >
      {Array.from({ length: 6 }, (_, indice) => (
        <path
          key={indice}
          d={`M ${148 - indice * 22} -8 L ${48 - indice * 22} 124`}
          stroke={color}
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}

function MetricaInicio({
  etiqueta,
  valor,
  total,
  detalle,
  color,
  icono,
}: {
  etiqueta: string;
  valor: number;
  total: number;
  detalle: ReactNode;
  color: string;
  icono: ReactNode;
}) {
  return (
    <article
      className="relative min-w-0 overflow-hidden rounded-[14px] border px-3 py-2.5"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, var(--color-surface)) 0%, var(--color-surface) 68%)`,
        borderColor: `color-mix(in srgb, ${color} 38%, var(--color-border))`,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <LineasDecorativas color={color} />
      <div className="relative flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            color,
            border: `1.5px solid ${color}`,
            boxShadow: `0 0 12px color-mix(in srgb, ${color} 38%, transparent)`,
          }}
        >
          {icono}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[8px] font-semibold tracking-[0.08em] text-text-tertiary">
            {etiqueta}
          </p>
          <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums" style={{ color }}>
            {valor} <span className="text-[10px] font-medium text-text-tertiary">de {total}</span>
          </p>
          <p className="mt-1 truncate text-[8px] leading-none text-text-secondary">{detalle}</p>
        </div>
      </div>
    </article>
  );
}

export function ResumenMetricasInicio({
  comidasRegistradas,
  comidasDisponibles,
  balanceSesiones,
}: {
  comidasRegistradas: number;
  comidasDisponibles: number;
  balanceSesiones: BalanceSesionesMes;
}) {
  const sesionesRestantes = balanceSesiones?.balance ?? 0;

  return (
    <section className="grid grid-cols-2 gap-2" aria-label="Resumen del día">
      <MetricaInicio
        etiqueta="COMIDAS DE HOY"
        valor={comidasRegistradas}
        total={comidasDisponibles}
        detalle={
          comidasDisponibles > 0 && comidasRegistradas >= comidasDisponibles
            ? "Meta diaria completa"
            : `${Math.max(0, comidasDisponibles - comidasRegistradas)} por registrar`
        }
        color="var(--color-success)"
        icono={<Utensils size={17} />}
      />
      {balanceSesiones ? (
        <MetricaInicio
          etiqueta="SESIONES DEL MES"
          valor={balanceSesiones.consumidas}
          total={balanceSesiones.asignadas}
          detalle={
            sesionesRestantes >= 0
              ? `Quedan ${sesionesRestantes} sesiones`
              : `${Math.abs(sesionesRestantes)} extra este mes`
          }
          color="var(--color-acento-fuerte)"
          icono={<Calendar size={17} />}
        />
      ) : (
        <MetricaInicio
          etiqueta="SESIONES DEL MES"
          valor={0}
          total={0}
          detalle="Sin plan mensual"
          color="var(--color-acento-fuerte)"
          icono={<Calendar size={17} />}
        />
      )}
    </section>
  );
}
