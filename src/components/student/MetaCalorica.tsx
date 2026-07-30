import { Clock } from "lucide-react";
import type { PlanAlimentacion } from "@/app/alumno/comer/data";

/** Barra de avance hacia la meta del día: verde cuando está en rango
 * (90-110%), ámbar si falta, rojo si se pasó bastante. */
function colorAvance(pct: number): string {
  if (pct > 110) return "var(--color-error)";
  if (pct >= 90) return "var(--color-success)";
  return "var(--color-vip)";
}

/** Resumen compacto para Inicio: cuánto lleva comido contra su meta. */
export function MetaCaloricaResumen({
  plan,
  kcalConsumidas,
}: {
  plan: NonNullable<PlanAlimentacion>;
  kcalConsumidas: number;
}) {
  if (plan.kcalObjetivo === null) return null;

  const pct = Math.round((kcalConsumidas / plan.kcalObjetivo) * 100);
  const restantes = plan.kcalObjetivo - kcalConsumidas;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-caption text-text-tertiary">
          META DEL DÍA · {plan.kcalObjetivo} KCAL
        </p>
        <p className="text-caption font-semibold" style={{ color: colorAvance(pct) }}>
          {pct}%
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: colorAvance(pct) }}
        />
      </div>
      <p className="text-caption mt-2 text-text-secondary">
        {restantes > 0
          ? `Te quedan ${restantes} kcal por consumir hoy.`
          : `Te pasaste por ${Math.abs(restantes)} kcal.`}
      </p>
    </div>
  );
}

/** Detalle para la pantalla Comer: meta, macros y horarios de cada comida. */
export function MetaCaloricaDetalle({
  plan,
  kcalConsumidas,
}: {
  plan: NonNullable<PlanAlimentacion>;
  kcalConsumidas: number;
}) {
  const macros = [
    { etiqueta: "PROT", valor: plan.protObjetivo },
    { etiqueta: "CARB", valor: plan.carbObjetivo },
    { etiqueta: "GRASA", valor: plan.grasaObjetivo },
  ].filter((m) => m.valor !== null);

  return (
    <div>
      {plan.kcalObjetivo !== null && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-h2 text-text">{kcalConsumidas}</span>
            <span className="text-body text-text-tertiary">de {plan.kcalObjetivo} kcal</span>
          </div>
          <MetaCaloricaResumen plan={plan} kcalConsumidas={kcalConsumidas} />
        </>
      )}

      {macros.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {macros.map((m) => (
            <div key={m.etiqueta} className="radius-control bg-surface-2 py-2.5">
              <p className="text-card-title text-text">{m.valor}g</p>
              <p className="text-caption text-text-tertiary">{m.etiqueta}</p>
            </div>
          ))}
        </div>
      )}

      {plan.comidas.length > 0 && (
        <div className="mt-5">
          <p className="text-caption mb-2 text-text-tertiary">TUS COMIDAS DEL DÍA</p>
          <div className="space-y-1.5">
            {plan.comidas.map((c, i) => (
              <div
                key={i}
                className="radius-control flex items-center justify-between gap-3 border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-body truncate text-text">{c.nombre}</p>
                  {c.descripcion && (
                    <p className="text-caption truncate text-text-tertiary">{c.descripcion}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {c.hora && (
                    <p className="text-secondary flex items-center gap-1 text-text-secondary">
                      <Clock size={13} /> {c.hora}
                    </p>
                  )}
                  {c.kcal !== null && <p className="text-caption text-vip">{c.kcal} kcal</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
