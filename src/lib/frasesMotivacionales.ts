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
    "Hoy entrenas, mañana lo agradecés, {nombre}.",
  ],
  comer: [
    "{nombre}, lo que comés hoy también es entrenamiento.",
    "Buenas decisiones en el plato, {nombre}, buenos resultados en el espejo.",
    "{nombre}, comer bien no es sacrificio, es inversión.",
    "Cada comida es una oportunidad de acercarte a tu objetivo, {nombre}.",
    "{nombre}, la disciplina también se sirve en la mesa.",
    "Nutrí el esfuerzo de hoy, {nombre} — te lo mereces.",
  ],
  progreso: [
    "{nombre}, mirá cuánto has avanzado — seguí así.",
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
