/** Medallas existentes, ahora con metas alcanzables mediante Puntos VIP. */
export const RANGOS = [
  { nombre: "Bronze", desde: 0, imagen: "/rangos/rank_bronze.png", color: "#c88a4a" },
  { nombre: "Silver", desde: 2_500, imagen: "/rangos/rank_silver.png", color: "#c0c4cc" },
  { nombre: "Gold", desde: 7_500, imagen: "/rangos/rank_gold.png", color: "#ffc247" },
  { nombre: "Platinum", desde: 15_000, imagen: "/rangos/rank_platinum.png", color: "#8fd4e8" },
  { nombre: "Diamond", desde: 30_000, imagen: "/rangos/rank_diamond.png", color: "#5fc8ff" },
  { nombre: "Champion", desde: 55_000, imagen: "/rangos/rank_champion.png", color: "#a78bfa" },
  {
    nombre: "Olympian VIP",
    desde: 90_000,
    imagen: "/rangos/rank_olympian_vip.png",
    color: "#7ec8ff",
  },
] as const;

export type Rango = (typeof RANGOS)[number];

export function rangoDePuntos(puntos: number): Rango {
  let actual: Rango = RANGOS[0];
  for (const rango of RANGOS) if (puntos >= rango.desde) actual = rango;
  return actual;
}

export function progresoAlSiguiente(
  puntos: number
): { siguiente: Rango; faltan: number; pct: number } | null {
  const indice = RANGOS.findIndex((rango) => rango.nombre === rangoDePuntos(puntos).nombre);
  const siguiente = RANGOS[indice + 1];
  if (!siguiente) return null;

  const base = RANGOS[indice].desde;
  const faltan = Math.max(0, siguiente.desde - puntos);
  const pct = Math.round(((puntos - base) / (siguiente.desde - base)) * 100);
  return { siguiente, faltan, pct: Math.max(0, Math.min(100, pct)) };
}

/** Mantiene el contrato usado por las tarjetas de Inicio y los reconocimientos. */
export type DesgloseSemana = {
  asistencia: number;
  alimentacion: number;
  app: number;
  total: number;
  totalCrudo: number;
};
