import { Calendar } from "lucide-react";
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

export function BalanceSesionesMes({ balance }: { balance: BalanceSesionesMesTipo }) {
  if (!balance) return null;
  const { consumidas, asignadas, balance: restante } = balance;
  const colorNumero = restante < 0 ? "text-error" : "text-vip";

  return (
    <Card className="!py-6 relative overflow-hidden">
      <RielesDecorativos />
      <div className="relative flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            border: "2px solid var(--color-acento)",
            boxShadow: "0 0 14px color-mix(in srgb, var(--color-acento) 45%, transparent)",
          }}
        >
          <Calendar size={22} className="text-acento-fuerte" />
        </div>
        <div>
          <p className="text-caption text-text-tertiary">SESIONES DEL MES</p>
          <p className={`text-h3 mt-1 ${colorNumero}`}>
            {consumidas} <span className="text-text-tertiary">de {asignadas}</span>
          </p>
          <p className="text-secondary text-text-secondary">
            {restante >= 0 ? `Quedan ${restante}` : `${Math.abs(restante)} de más este mes`}
          </p>
        </div>
      </div>
    </Card>
  );
}
