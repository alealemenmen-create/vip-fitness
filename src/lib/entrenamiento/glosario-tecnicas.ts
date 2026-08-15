/**
 * Explicación profesional de una técnica, a partir de la palabra clave que ya
 * escribe el entrenador (o la IA al leer un PDF) en `tecnica_tipo` /
 * `tecnica_instruccion` — texto libre, sin un campo estructurado por técnica.
 *
 * No reemplaza esa instrucción: la complementa. El entrenador puede escribir
 * los números exactos ("50, 30, 20 kg"); esto explica el PATRÓN general para
 * el alumno que nunca hizo un drop set y no sabe por dónde empezar.
 *
 * Pensado para `SesionEjercicioCard`: cuando el alumno llega al ejercicio que
 * trae una técnica, tiene que entender qué hacer sin buscar en otro lado.
 */
export type EntradaGlosarioTecnica = {
  etiqueta: string;
  patron: RegExp;
  explicacion: string;
  /** Técnica que conviene hacer con alguien cerca — al fallo, drop set,
   * rest-pause... Dispara un aviso motivador aparte, apenas arranca la
   * serie (pedido de Alejandro: "que le diga pídele ayuda a otro
   * entrenador", como el mensaje de Impulso VIP pero para esto). */
  requiereAyuda?: boolean;
};

// Orden de prioridad: de más específico a más genérico. "Drop set" antes que
// "descendente" porque un drop set también podría describirse como bajada de
// peso, y queremos el nombre más preciso cuando el texto lo nombra.
const GLOSARIO: EntradaGlosarioTecnica[] = [
  {
    etiqueta: "Drop set",
    patron: /drop\s*set|dropset/i,
    explicacion:
      "Al llegar al fallo técnico (o a las repeticiones indicadas), baja el peso entre 20% y 30% de inmediato, sin descansar, y sigue hasta un nuevo fallo. Repite la descarga tantas veces como pida tu rutina — cada bajada de peso cuenta como parte de la misma serie. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Rest-pause",
    patron: /rest.?pause/i,
    explicacion:
      "Lleva la serie cerca del fallo, descansa 10 a 20 segundos sin soltar el peso, y suma unas repeticiones más. Repite esa micro-pausa 1 o 2 veces dentro de la misma serie antes de dar por terminado el set. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Myo-reps",
    patron: /myo/i,
    explicacion:
      "Una primera serie de activación cerca del fallo, seguida de mini-series de 3 a 5 repeticiones con descansos muy cortos (10 a 20 segundos) entre cada una, hasta que ya no completes el mínimo pedido. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Cluster",
    patron: /cluster/i,
    explicacion:
      "Divide la serie en mini-bloques de 1 a 3 repeticiones con descansos cortos (10 a 20 segundos) entre cada bloque — sostienes más peso total del que aguantarías en una serie continua. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "AMRAP",
    patron: /amrap|m[aá]ximo posible/i,
    explicacion:
      "Haz tantas repeticiones de buena técnica como puedas — \"as many reps as possible\". Para apenas la técnica empiece a fallar, no antes: la cuenta la decide tu forma, no tu voluntad. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Serie descendente",
    patron: /descendente|piramidal/i,
    explicacion:
      "Cada serie baja el peso y mantiene o sube las repeticiones respecto a la anterior: empiezas pesado y terminas liviano, sin perder la técnica en ninguna vuelta.",
  },
  {
    etiqueta: "Al fallo",
    patron: /\bfallo\b/i,
    explicacion:
      "Haz repeticiones hasta que la técnica correcta ya no te dé para una más — el fallo es técnico, no que el peso se caiga al piso. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Burnout",
    patron: /burnout|agotamiento/i,
    explicacion:
      "Cierra el ejercicio con una serie final al fallo absoluto, casi siempre con menos peso que las anteriores. Es la última serie de este ejercicio — no hay otra después. Pide ayuda a tu entrenador o a un compañero para esta serie.",
    requiereAyuda: true,
  },
  {
    etiqueta: "Superserie",
    patron: /superserie/i,
    explicacion:
      "Dos ejercicios de grupos musculares distintos, uno detrás del otro, sin descansar entre ellos. El descanso real llega recién después de completar los dos.",
  },
  {
    etiqueta: "Biserie",
    patron: /biserie|biset/i,
    explicacion:
      "Dos ejercicios del mismo grupo muscular, uno detrás del otro, sin descansar entre ellos — la fatiga se acumula antes de que llegue el descanso.",
  },
  {
    etiqueta: "Triserie",
    patron: /triserie/i,
    explicacion:
      "Tres ejercicios encadenados sin descanso entre ellos, normalmente del mismo grupo muscular o de grupos que se complementan.",
  },
  {
    etiqueta: "Giant set",
    patron: /giant set|serie gigante/i,
    explicacion:
      "Cuatro o más ejercicios encadenados sin descanso: el bloque completo se entrena como si fuera una sola serie larga.",
  },
  {
    etiqueta: "Circuito",
    patron: /circuito|tabata/i,
    explicacion:
      "Una secuencia de ejercicios que se repite en bloque, con descansos cortos (o sin descanso) entre cada estación — el descanso más largo llega al terminar la vuelta completa.",
  },
];

/** Busca en el texto (técnica + instrucción, lo que haya) la primera técnica
 * conocida del glosario. `null` si no reconoce ninguna palabra clave — la
 * instrucción libre del entrenador sigue siendo la única fuente en ese caso. */
export function explicacionTecnica(texto: string | null | undefined): EntradaGlosarioTecnica | null {
  if (!texto) return null;
  return GLOSARIO.find((entrada) => entrada.patron.test(texto)) ?? null;
}
