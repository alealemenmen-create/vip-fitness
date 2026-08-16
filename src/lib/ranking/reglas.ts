/** Reglas simples y visibles de Progreso VIP. No tocan la base de datos. */

export const PUNTOS_VIP = {
  entrenamientoMaximo: 300,
  alimentacionMaximo: 250,
  ingresoDiario: 30,
  pesoSemanal: 75,
  // Antes semanal, cada 15 días desde 2026-08-16 (pedido de Alejandro: el
  // físico tarda más que el peso en mostrar un cambio real).
  fotoQuincenal: 100,
  alimentacionSinRegistro: -100,
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
  // El alumno apagó su propio temporizador de descanso (no el entrenador):
  // reemplaza el bono normal de "Entrenamiento finalizado" (hasta 300) por
  // esta penalización fija, sin importar cuántos ejercicios completó.
  entrenamientoSinDescansoPorAlumno: -50,
  tecnicaAsignadaCumplida: 15,
} as const;

export type CumplimientoImpulso = "cumplida" | "superada" | "parcial" | "no_cumplida";

export function limitarTramosDescanso(tramos: number): number {
  const maximoTramos = Math.ceil(
    PUNTOS_VIP.descansoPenalizacionMaxima /
      PUNTOS_VIP.descansoPenalizacionPorTramo
  );
  if (!Number.isFinite(tramos)) return 0;
  return Math.max(0, Math.min(maximoTramos, Math.floor(tramos)));
}

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
  diaCerrado = false,
  proteina: number | null = null,
  objetivoProteina: number | null = null
): number {
  if (!objetivo || objetivo <= 0) return 0;
  const puntuaProteina = objetivoProteina !== null && objetivoProteina > 0;
  const maximoCalorias = puntuaProteina ? 200 : PUNTOS_VIP.alimentacionMaximo;
  const maximoProteina = puntuaProteina ? PUNTOS_VIP.alimentacionMaximo - maximoCalorias : 0;
  const puntosProteina = puntuaProteina
    ? Math.round(maximoProteina * Math.max(0, Math.min(1, (proteina ?? 0) / objetivoProteina)))
    : 0;
  if (!diaCerrado) {
    const avance = Math.max(0, Math.min(1, kcal / objetivo));
    return Math.round(maximoCalorias * avance) + puntosProteina;
  }
  if (kcal <= 0) return PUNTOS_VIP.alimentacionSinRegistro;

  const porcentaje = (kcal / objetivo) * 100;
  const puntajeCalorias = Math.round(
    maximoCalorias * (1 - Math.abs(porcentaje - 100) / 50)
  );
  return Math.max(
    PUNTOS_VIP.alimentacionPenalizacionMaxima,
    Math.min(PUNTOS_VIP.alimentacionMaximo, puntajeCalorias + puntosProteina)
  );
}

export function ayudaAlimentacion(
  kcal: number,
  objetivo: number | null,
  proteina: number | null = null,
  objetivoProteina: number | null = null
): string {
  if (!objetivo || objetivo <= 0) return "Tu entrenador debe definir una meta de calorias para puntuar este dia";
  const porcentaje = Math.round((kcal / objetivo) * 100);
  const progresoProteina = objetivoProteina && objetivoProteina > 0
    ? ` · proteína ${Math.round(((proteina ?? 0) / objetivoProteina) * 100)}%`
    : "";
  if (porcentaje < 100) return `${porcentaje}% de tu meta${progresoProteina} · puntos provisionales hasta cerrar el dia`;
  if (porcentaje <= 110) return "Meta alcanzada · el puntaje definitivo se confirma al cerrar el dia";
  return `${porcentaje}% de tu meta · alejarte del objetivo reduce el puntaje final`;
}
