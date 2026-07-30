import type { PlanAlimentacion } from "@/app/alumno/comer/data";

/** Mismo criterio de color que MetaCaloricaResumen: verde en rango (90-110%),
 * ámbar si falta, rojo si se pasó. */
function colorAvance(pct: number): string {
  if (pct > 110) return "var(--color-error)";
  if (pct >= 90) return "var(--color-success)";
  return "var(--color-vip)";
}

/**
 * Alimentación de hoy: rectángulo de ancho completo, debajo del mensaje de la
 * IA en Inicio. Estuvo un tiempo metido dentro de la tarjeta del perfil, pero
 * ahí apretaba todo y no se leía.
 */
export function AlimentacionHoyCuadro({
  kcal,
  prot,
  carb,
  grasa,
  plan,
}: {
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  plan: PlanAlimentacion;
}) {
  const objetivo = plan?.kcalObjetivo ?? null;
  const pct = objetivo ? Math.round((kcal / objetivo) * 100) : null;

  return (
    <div className="radius-card w-full bg-surface px-4 py-6">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-caption text-text-tertiary">ALIMENTACIÓN DE HOY</p>
        {objetivo && (
          <p className="text-caption shrink-0 text-text-tertiary">
            meta <span className="tabular-nums text-text-secondary">{objetivo}</span> kcal
          </p>
        )}
      </div>

      {/* Los cuatro valores en una sola línea, en columnas iguales. */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { etiqueta: "KCAL", valor: String(kcal), acento: true },
          { etiqueta: "PROT", valor: `${prot}g`, acento: false },
          { etiqueta: "CARB", valor: `${carb}g`, acento: false },
          { etiqueta: "GRASA", valor: `${grasa}g`, acento: false },
        ].map((m) => (
          <div key={m.etiqueta} className="min-w-0">
            <p
              className={`truncate text-[20px] font-bold leading-tight tabular-nums ${
                m.acento ? "text-vip" : "text-text"
              }`}
            >
              {m.valor}
            </p>
            <p className="text-caption mt-0.5 text-text-tertiary">{m.etiqueta}</p>
          </div>
        ))}
      </div>

      {pct !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: colorAvance(pct) }}
          />
        </div>
      )}
    </div>
  );
}
