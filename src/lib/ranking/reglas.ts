/** Reglas simples y visibles de Progreso VIP. No tocan la base de datos. */

export const PUNTOS_VIP = {
  entrenamientoMaximo: 60,
  entrenamientoEjercicios: 40,
  entrenamientoFinalizado: 20,
  alimentacionMaximo: 40,
  checkinDiario: 10,
  pesoSemanal: 20,
  fotoSemanal: 30,
} as const;

/**
 * Durante la rutina estos puntos se muestran como "preparados". Se confirman
 * juntos al pulsar Finalizar, por lo que cerrar o recargar la pantalla no crea
 * duplicados.
 */
export function calcularPuntosEntrenamiento(completados: number, total: number): number {
  if (total <= 0) return 0;
  const proporcion = Math.max(0, Math.min(1, completados / total));
  const porEjercicios = Math.round(PUNTOS_VIP.entrenamientoEjercicios * proporcion);
  const bonoFinal = proporcion >= 0.7 ? PUNTOS_VIP.entrenamientoFinalizado : 0;
  return porEjercicios + bonoFinal;
}

/**
 * Premia aproximarse al objetivo calorico, sin fomentar registrar alimentos
 * ficticios ni comer de mas. La recompensa se recalcula al editar el dia.
 */
export function calcularPuntosAlimentacion(kcal: number, objetivo: number | null): number {
  if (kcal <= 0) return 0;
  if (!objetivo || objetivo <= 0) return Math.min(20, Math.max(5, Math.round(kcal / 250) * 5));

  const pct = (kcal / objetivo) * 100;
  if (pct < 25) return 5;
  if (pct < 50) return 10;
  if (pct < 75) return 20;
  if (pct < 90) return 30;
  if (pct <= 110) return PUNTOS_VIP.alimentacionMaximo;
  if (pct <= 125) return 30;
  return 20;
}

export function siguienteMetaAlimentacion(puntos: number): { puntos: number; texto: string } | null {
  if (puntos < 10) return { puntos: 10, texto: "Alcanza el 25% de tus calorias" };
  if (puntos < 20) return { puntos: 20, texto: "Alcanza la mitad de tus calorias" };
  if (puntos < 30) return { puntos: 30, texto: "Alcanza el 75% de tus calorias" };
  if (puntos < 40) return { puntos: 40, texto: "Queda entre 90% y 110% de tu meta" };
  return null;
}
