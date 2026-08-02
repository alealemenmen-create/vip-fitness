/** Reglas simples y visibles de Progreso VIP. No tocan la base de datos. */

export const PUNTOS_VIP = {
  entrenamientoMaximo: 300,
  alimentacionMaximo: 250,
  ingresoDiario: 30,
  pesoSemanal: 75,
  fotoSemanal: 100,
  alimentacionSinRegistro: -150,
  alimentacionPenalizacionMaxima: -100,
} as const;

/**
 * Durante la rutina estos puntos se muestran como "preparados". Se confirman
 * juntos al pulsar Finalizar, por lo que cerrar o recargar la pantalla no crea
 * duplicados.
 */
export function calcularPuntosEntrenamiento(completados: number, total: number): number {
  if (total <= 0) return 0;
  const proporcion = Math.max(0, Math.min(1, completados / total));
  return Math.round(PUNTOS_VIP.entrenamientoMaximo * proporcion);
}

/**
 * Durante el dia solo muestra avance provisional hacia la meta. Al cerrar el
 * dia se puntua la precision: 100% entrega el maximo, 75%/125% entrega la
 * mitad, 50%/150% entrega cero y alejarse mas genera una penalizacion gradual.
 */
export function calcularPuntosAlimentacion(
  kcal: number,
  objetivo: number | null,
  diaCerrado = false
): number {
  if (!objetivo || objetivo <= 0) return 0;
  if (!diaCerrado) {
    const avance = Math.max(0, Math.min(1, kcal / objetivo));
    return Math.round(PUNTOS_VIP.alimentacionMaximo * avance);
  }
  if (kcal <= 0) return PUNTOS_VIP.alimentacionSinRegistro;

  const porcentaje = (kcal / objetivo) * 100;
  const puntaje = Math.round(
    PUNTOS_VIP.alimentacionMaximo * (1 - Math.abs(porcentaje - 100) / 50)
  );
  return Math.max(
    PUNTOS_VIP.alimentacionPenalizacionMaxima,
    Math.min(PUNTOS_VIP.alimentacionMaximo, puntaje)
  );
}

export function ayudaAlimentacion(kcal: number, objetivo: number | null): string {
  if (!objetivo || objetivo <= 0) return "Tu entrenador debe definir una meta de calorias para puntuar este dia";
  const porcentaje = Math.round((kcal / objetivo) * 100);
  if (porcentaje < 100) return `${porcentaje}% de tu meta · puntos provisionales hasta cerrar el dia`;
  if (porcentaje <= 110) return "Meta alcanzada · el puntaje definitivo se confirma al cerrar el dia";
  return `${porcentaje}% de tu meta · alejarte del objetivo reduce el puntaje final`;
}
