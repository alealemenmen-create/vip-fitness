export type CodigoPlanEntrenamiento = "access" | "select" | "pro" | "elite";

export type PlanEntrenamiento = {
  codigo: CodigoPlanEntrenamiento;
  nombre: string;
  sesionesMensuales: number;
  diasSemana: number;
  precioCLP: number | null;
};

export const PLANES_ENTRENAMIENTO: Record<CodigoPlanEntrenamiento, PlanEntrenamiento> = {
  access: { codigo: "access", nombre: "Plan Access", sesionesMensuales: 12, diasSemana: 3, precioCLP: null },
  select: { codigo: "select", nombre: "Plan Select", sesionesMensuales: 12, diasSemana: 3, precioCLP: 75_000 },
  pro: { codigo: "pro", nombre: "Plan Pro", sesionesMensuales: 16, diasSemana: 4, precioCLP: 89_000 },
  elite: { codigo: "elite", nombre: "Plan Élite", sesionesMensuales: 20, diasSemana: 5, precioCLP: 103_000 },
};

export function esCodigoPlanEntrenamiento(valor: string): valor is CodigoPlanEntrenamiento {
  return Object.hasOwn(PLANES_ENTRENAMIENTO, valor);
}

export function resolverPlanEntrenamiento(
  codigo: string | null | undefined,
  sesionesMensuales?: number | null,
  diasSemana?: number | null
): PlanEntrenamiento | null {
  if (!codigo || !esCodigoPlanEntrenamiento(codigo)) return null;
  const base = PLANES_ENTRENAMIENTO[codigo];
  return {
    ...base,
    sesionesMensuales: sesionesMensuales ?? base.sesionesMensuales,
    diasSemana: diasSemana ?? base.diasSemana,
  };
}
