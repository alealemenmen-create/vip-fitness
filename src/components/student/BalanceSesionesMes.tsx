import { Card } from "@/components/ui/Card";
import type { BalanceSesionesMes as BalanceSesionesMesTipo } from "@/app/alumno/entrenar/data";

export function BalanceSesionesMes({ balance }: { balance: BalanceSesionesMesTipo }) {
  if (!balance) return null;
  const { consumidas, asignadas, balance: restante } = balance;
  const colorNumero = restante < 0 ? "text-error" : "text-vip";

  return (
    <Card className="!py-8">
      <p className="text-caption text-text-tertiary">SESIONES DEL MES</p>
      <p className={`text-h3 mt-1 ${colorNumero}`}>
        {consumidas} <span className="text-text-tertiary">de {asignadas}</span>
      </p>
      <p className="text-secondary text-text-secondary">
        {restante >= 0 ? `Quedan ${restante}` : `${Math.abs(restante)} de más este mes`}
      </p>
    </Card>
  );
}
