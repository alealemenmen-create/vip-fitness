import { hoyISO } from "@/lib/date";

export type CategoriaFrase = "inicio" | "entrenar" | "comer" | "progreso";

const FRASES: Record<CategoriaFrase, string[]> = {
  inicio: [
    "Volviste para ser más fuerte, {nombre}. Lo estás logrando.",
    "{nombre}, no te cansas — y eso ya te hace diferente.",
    "Cada vez que vuelves, ganas. Bienvenido/a de nuevo, {nombre}.",
    "{nombre}, la constancia de hoy es el resultado de mañana.",
    "Un día más entrenando tu mejor versión, {nombre}.",
    "{nombre}, presente otra vez. Así se construyen los resultados.",
  ],
  entrenar: [
    "{nombre}, hoy toca dar lo mejor.",
    "Un entrenamiento más, {nombre}. ¡Vamos!",
    "{nombre}, tu constancia hace la diferencia.",
    "Cada serie cuenta, {nombre}. A darlo todo.",
    "{nombre}, nadie dijo que sería fácil — por eso vale la pena.",
    "Hoy entrenas, mañana lo agradeces, {nombre}.",
  ],
  comer: [
    "{nombre}, lo que comes hoy también es entrenamiento.",
    "Buenas decisiones en el plato, {nombre}, buenos resultados en el espejo.",
    "{nombre}, comer bien no es sacrificio, es inversión.",
    "Cada comida es una oportunidad de acercarte a tu objetivo, {nombre}.",
    "{nombre}, la disciplina también se sirve en la mesa.",
    "Nutre el esfuerzo de hoy, {nombre} — te lo mereces.",
  ],
  progreso: [
    "{nombre}, mira cuánto has avanzado — sigue así.",
    "El progreso no siempre se ve rápido, {nombre}, pero se acumula.",
    "{nombre}, cada registro es una prueba de tu esfuerzo.",
    "No compares tu día 1 con el de otro, {nombre}. Este es tu camino.",
    "{nombre}, los números de hoy son el punto de partida de mañana.",
    "Sé constante, {nombre} — el progreso premia a quien no abandona.",
  ],
};

/** Frase del día por categoría — determinística (misma frase todo el día,
 * cambia al día siguiente), para no romper la pureza de los Server Components. */
export function fraseDelDia(categoria: CategoriaFrase, nombre: string): string {
  const lista = FRASES[categoria];
  const indice = Number(hoyISO().slice(-2)) % lista.length;
  return lista[indice].replace("{nombre}", nombre || "campeón/a");
}

/**
 * Consejos para MIENTRAS se entrena — se muestran fijos abajo en la pantalla
 * de la sesión y van rotando solos.
 *
 * A diferencia de `FRASES`, que son de ánimo general, estos son de ejecución:
 * técnica, tempo, registro, esfuerzo. La idea es que el alumno aprenda algo
 * entre serie y serie, no que le repitan "tú puedes".
 *
 * Sin `{nombre}`: se leen de reojo en medio de una serie y el nombre solo
 * alarga la frase. Conviene mantener la lista larga —rota cada pocos segundos
 * y con pocas se nota la repetición— y cada frase corta, de una línea.
 */
export const CONSEJOS_ENTRENAMIENTO: string[] = [
  "Repeticiones lentas, suma efectiva.",
  "Llevar el control de tu entrenamiento te pone en otro nivel.",
  "¿No puedes dos más? Entonces haz tres.",
  "Baja el peso en tres segundos: ahí está la mitad del trabajo.",
  "La última repetición es la que cuenta. Las otras la preparan.",
  "Anota el peso. Lo que no se mide, no mejora.",
  "Técnica primero, peso después.",
  "Si la técnica se rompe, la serie terminó.",
  "Rango completo. Media repetición es medio resultado.",
  "Descansa lo que toca: el descanso es parte de la serie, no una pausa.",
  "Suelta el aire cuando empujas. No aguantes la respiración.",
  "Supera la semana pasada aunque sea por una repetición.",
  "Un kilo más o una repetición más: las dos son progreso.",
  "Controla la bajada. Ahí es donde nadie mira y todo pasa.",
  "Ocho buenas valen más que quince apuradas.",
  "Si la serie te salió fácil, la próxima sube el peso.",
  "Piensa en el músculo que trabaja, no en el peso que mueves.",
  "Registra cada serie. Tu yo de la próxima semana te lo va a agradecer.",
  "Hoy no tienes que ser el mejor. Solo mejor que ayer.",
  "Volumen sin técnica es solo cansancio.",
  "Aprieta el músculo arriba y sostén un segundo.",
  "Empieza la serie cuando estés listo, no cuando el reloj lo diga.",
  "Los pies firmes: la fuerza sube desde el suelo.",
  "Si puedes hablar tranquilo, todavía queda esfuerzo adentro.",
  "El peso no baja: tú lo bajas. Esa es la diferencia.",
  "Calienta la primera serie. Las lesiones llegan por apurados.",
  "No compares tu peso con el de al lado. Compáralo con el tuyo de ayer.",
  "Termina la última serie igual de concentrado que la primera.",
];

/** Índice de arranque de los consejos, estable dentro del mismo día para que
 * el servidor y el cliente pinten lo mismo en la primera pasada. Desde ahí, el
 * componente sigue rotando en el navegador. */
export function consejoInicial(): number {
  return Number(hoyISO().slice(-2)) % CONSEJOS_ENTRENAMIENTO.length;
}
