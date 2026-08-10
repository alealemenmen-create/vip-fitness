import { Calendar, PauseCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { BalanceSesionesMes as BalanceSesionesMesTipo } from "@/app/alumno/entrenar/data";

/** Rieles diagonales decorativos, sutiles, en la esquina — puramente
 * ornamentales (aria-hidden), imitan la textura de fondo de la tarjeta de
 * referencia sin depender de ninguna imagen. */
function RielesDecorativos() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-6 -top-6 opacity-[0.18]"
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <path
          key={i}
          d={`M ${200 - i * 26} -10 L ${60 - i * 26} 170`}
          stroke="var(--color-acento-fuerte)"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export function BalanceSesionesMes({
  balance,
  compacta = false,
}: {
  balance: BalanceSesionesMesTipo;
  compacta?: boolean;
}) {
  if (!balance) return null;
  const { consumidas, asignadas, balance: restante, planNombre, diasSemana, pausado, configurado } = balance;
  const colorNumero = restante < 0 ? "text-error" : "text-vip";

  return (
    <Card
      padding={compacta ? "p-3" : "p-6"}
      className="relative overflow-hidden border"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-acento) 16%, var(--color-surface)) 0%, var(--color-surface) 65%)",
        borderColor: "color-mix(in srgb, var(--color-acento) 35%, var(--color-border))",
      }}
    >
      <RielesDecorativos />
      <div className={`relative flex items-center ${compacta ? "gap-3" : "gap-4"}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-full ${
            compacta ? "h-10 w-10" : "h-14 w-14"
          }`}
          style={{
            border: "2px solid var(--color-acento)",
            boxShadow: "0 0 14px color-mix(in srgb, var(--color-acento) 45%, transparent)",
          }}
        >
          {pausado ? (
            <PauseCircle size={compacta ? 17 : 22} className="text-warning" />
          ) : (
            <Calendar size={compacta ? 17 : 22} className="text-vip" />
          )}
        </div>
        <div>
          <p className="text-caption text-text-tertiary">
            {planNombre ? `${planNombre.toUpperCase()} · SESIONES DEL MES` : "SESIONES DEL MES"}
          </p>
          <p className={`${compacta ? "mt-0.5 text-[18px] font-bold leading-none" : "text-h3 mt-1"} ${colorNumero}`}>
            {consumidas} <span className="text-text-tertiary">de {asignadas}</span>
          </p>
          <p className={`${compacta ? "mt-1 text-[9px]" : "text-secondary"} text-text-secondary`}>
            {pausado ? (
              <span className="font-semibold text-warning">Plan pausado · progreso conservado</span>
            ) : restante >= 0 ? (
              <>
                Quedan <span className="text-acento-fuerte font-semibold">{restante}</span> sesiones · {diasSemana} recomendadas por semana
              </>
            ) : (
              `${Math.abs(restante)} de más este mes`
            )}
          </p>
          {!configurado && (
            <p className="mt-1 text-[8px] text-warning">Plan comercial pendiente de asignar por el entrenador</p>
          )}
        </div>
      </div>
    </Card>
  );
}
