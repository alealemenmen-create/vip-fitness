/**
 * Tempo de un ejercicio: cuánto dura cada fase de la repetición.
 *
 * Notación estándar de cuatro números, en segundos:
 *
 *     excéntrica - pausa abajo - concéntrica - pausa arriba
 *
 * "3-1-1-0" = bajar en 3 segundos, aguantar 1 abajo, subir en 1, sin pausa
 * arriba. Es lo que más mueve la aguja en hipertrofia después de la carga:
 * alargar la fase excéntrica y controlar la pausa aumenta el tiempo bajo
 * tensión sin tener que subir el peso.
 *
 * De dónde sale, en orden de prioridad:
 *   1. Lo que el entrenador escribió en la rutina (observación o técnica).
 *      Si lo escribió, manda — ver `leerTempoDelTexto`.
 *   2. El tempo guardado en la biblioteca, deducido por IA una vez por
 *      ejercicio — ver src/lib/ai/tempoEjercicio.ts.
 *   3. Nada: la tarjeta simplemente no muestra la columna de tempo.
 */

export type Tempo = {
  /** Los cuatro números, ya normalizados: "3-1-1-0". */
  valor: string;
  /** Una línea explicando el porqué, cuando se sabe. */
  nota: string | null;
  origen: "rutina" | "biblioteca";
};

/*
  Reconoce el tempo escrito a mano dentro de un texto libre. El entrenador lo
  anota de formas muy distintas y todas tienen que valer:

    "tempo 3-1-1-0"        "3/1/1/0"        "3010"
    "2-0-1"  (tres fases, la pausa de arriba se asume 0)
    "1-2s concéntrica, 1s contracción, 2-3s excéntrica"  ← rangos en prosa

  El último caso es el que más aparece en las rutinas reales, y no está en
  notación estándar: viene en orden inverso (concéntrica primero) y con rangos.
  Se traduce tomando el extremo alto de cada rango, que es el que respeta el
  alumno cuando el músculo ya está cansado.
*/
const RE_CUATRO = /(\d)\s*[-/:]\s*(\d)\s*[-/:]\s*(\d)\s*[-/:]\s*(\d)/;
const RE_TRES = /(\d)\s*[-/:]\s*(\d)\s*[-/:]\s*(\d)/;
const RE_PEGADO = /\btempo\s*:?\s*(\d)(\d)(\d)(\d)\b/i;

/** Prosa tipo "1-2s concéntrica, 1s contracción, 2-3s excéntrica". */
const RE_FASE_PROSA =
  /(\d)(?:\s*-\s*(\d))?\s*s?\s*(?:de\s+)?(conc[ée]ntrica|exc[ée]ntrica|contracci[óo]n|pausa|isom[ée]trica)/gi;

function extremoAlto(a: string, b: string | undefined): number {
  return Number(b ?? a);
}

export function leerTempoDelTexto(texto: string | null | undefined): Tempo | null {
  if (!texto) return null;

  const pegado = texto.match(RE_PEGADO);
  if (pegado) {
    return { valor: `${pegado[1]}-${pegado[2]}-${pegado[3]}-${pegado[4]}`, nota: null, origen: "rutina" };
  }

  const cuatro = texto.match(RE_CUATRO);
  if (cuatro) {
    return { valor: `${cuatro[1]}-${cuatro[2]}-${cuatro[3]}-${cuatro[4]}`, nota: null, origen: "rutina" };
  }

  // La prosa se intenta ANTES que el patrón de tres números sueltos: "1-2s
  // concéntrica, 1s contracción, 2-3s excéntrica" también encaja en RE_TRES
  // (leería "2-1-2"), pero en el orden equivocado.
  const fases: Record<string, number> = {};
  for (const m of texto.matchAll(RE_FASE_PROSA)) {
    const fase = m[3].toLowerCase();
    const segundos = extremoAlto(m[1], m[2]);
    if (fase.startsWith("conc")) fases.concentrica = segundos;
    else if (fase.startsWith("exc")) fases.excentrica = segundos;
    else fases.pausa = segundos;
  }
  if (fases.excentrica !== undefined && fases.concentrica !== undefined) {
    return {
      valor: `${fases.excentrica}-${fases.pausa ?? 0}-${fases.concentrica}-0`,
      nota: null,
      origen: "rutina",
    };
  }

  const tres = texto.match(RE_TRES);
  if (tres) {
    return { valor: `${tres[1]}-${tres[2]}-${tres[3]}-0`, nota: null, origen: "rutina" };
  }

  return null;
}

/**
 * El tempo que le toca mostrar a un ejercicio de la sesión.
 *
 * `textos` son los campos libres de la rutina donde el entrenador pudo haberlo
 * escrito (observación, instrucción de técnica). Lo escrito gana siempre: si
 * el entrenador se tomó el trabajo de anotarlo, no lo pisa la IA.
 */
export function resolverTempo(
  textos: (string | null | undefined)[],
  tempoBiblioteca: string | null | undefined,
  notaBiblioteca: string | null | undefined
): Tempo | null {
  for (const texto of textos) {
    const escrito = leerTempoDelTexto(texto);
    if (escrito) return escrito;
  }
  if (tempoBiblioteca) {
    return { valor: tempoBiblioteca, nota: notaBiblioteca ?? null, origen: "biblioteca" };
  }
  return null;
}

/** Texto largo del tempo, para la ficha del ejercicio: "3s bajando · 1s abajo · 1s subiendo". */
export function explicarTempo(valor: string): string {
  const [exc, pausaAbajo, con, pausaArriba] = valor.split("-").map(Number);
  const partes = [`${exc}s bajando`];
  if (pausaAbajo > 0) partes.push(`${pausaAbajo}s abajo`);
  partes.push(`${con}s subiendo`);
  if (pausaArriba > 0) partes.push(`${pausaArriba}s arriba`);
  return partes.join(" · ");
}
