/** Reglas simples y visibles de Progreso VIP. No tocan la base de datos. */

export const PUNTOS_VIP = {
  entrenamientoMaximo: 300,
  alimentacionMaximo: 250,
  ingresoDiario: 30,
  pesoSemanal: 75,
  fotoSemanal: 100,
  alimentacionSinRegistro: -150,
  alimentacionPenalizacionMaxima: -100,
  // Impulso VIP: bono chico frente a los 300 de completar la sesión — no
  // debe competir con eso, solo premiar además haber seguido la meta.
  // Reglas D (reducir) y E (consultar) nunca puntúan: no son una meta
  // lograda, son una pausa o una corrección.
  impulsoCumplida: 8,
  impulsoSuperada: 12,
  impulsoParcial: 3,
  // Tope por sesión: aunque haya 8 ejercicios con recomendación, Impulso VIP
  // no puede aportar más que una fracción chica del máximo de entrenamiento.
  impulsoMaximoPorSesion: 60,
  // Descansar de más: por cada tramo completo excedido después de que
  // termina el descanso indicado, se resta esta cantidad de puntos, hasta el
  // tope por serie. Nunca revierte los puntos ya ganados por completar la
  // serie — es un ajuste aparte (categoría "ajuste").
  descansoSegundosPorTramo: 20,
  descansoPenalizacionPorTramo: 3,
  descansoPenalizacionMaxima: 30,
} as const;

export type CumplimientoImpulso = "cumplida" | "superada" | "parcial" | "no_cumplida";

/** Puntos por una recomendación resuelta. Se llama una vez por cada
 * ejercicio puntuable de la sesión, y el resultado se suma y se topea en
 * `PUNTOS_VIP.impulsoMaximoPorSesion` (ver `registrarImpulso` en
 * `movimientos.ts`) — acá solo se calcula el valor de una fila. */
export function calcularPuntosImpulso(cumplimiento: CumplimientoImpulso | null): number {
  switch (cumplimiento) {
    case "superada":
      return PUNTOS_VIP.impulsoSuperada;
    case "cumplida":
      return PUNTOS_VIP.impulsoCumplida;
    case "parcial":
      return PUNTOS_VIP.impulsoParcial;
    default:
      return 0;
  }
}

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
