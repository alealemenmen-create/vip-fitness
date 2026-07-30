import { normalizar } from "@/lib/alimentos/emparejar";
import type { Ejercicio } from "./tipos";

/**
 * Cruza el nombre suelto que la IA sacó del PDF contra la biblioteca de
 * ejercicios. Es el mismo problema que ya estaba resuelto para los alimentos
 * (`src/lib/alimentos/emparejar.ts`) y sigue el mismo criterio: nada de IA,
 * solo comparación de texto normalizado, y si no llega al umbral se devuelve
 * `null` para que el entrenador lo resuelva a mano.
 *
 * La diferencia con los alimentos es `aliases`: cada entrenador nombra distinto
 * el mismo movimiento ("jalón al pecho", "jalón amplio", "lat pulldown"), así
 * que la biblioteca guarda todas las formas conocidas y acá se comparan todas.
 *
 * Preferir `null` antes que un emparejado dudoso es deliberado: mostrarle al
 * alumno el dibujo de otro ejercicio es peor que no mostrarle ninguno.
 */

const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "con", "sin", "a", "al", "en", "y", "o",
  "para", "tipo", "estilo", "maquina", "ejercicio",
]);

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t));
}

export type ConfianzaEjercicio = "exacta" | "alta" | "media";

export type EmparejamientoEjercicio = {
  ejercicio: Ejercicio;
  confianza: ConfianzaEjercicio;
} | null;

/** Todas las formas de nombrar un ejercicio: su nombre, su slug y sus alias. */
function nombresDe(ejercicio: Ejercicio): string[] {
  return [ejercicio.nombre, ejercicio.slug.replace(/-/g, " "), ...ejercicio.aliases];
}

/** Adjetivos que describen CÓMO se hace el ejercicio, no cuál es. Sacarlos
 * deja el nombre del movimiento: "Dominadas estrictas" → "Dominadas". */
const CALIFICADORES =
  /\b(estrict[ao]s?|lent[ao]s?|pesad[ao]s?|liger[ao]s?|parcial(?:es)?|gigantes?|abiert[ao]s?|cerrad[ao]s?|isometrias?|alt[ao]s?|reps?)\b/g;

/**
 * Variantes progresivamente más simples del nombre, de la más fiel a la más
 * recortada. Los entrenadores escriben cosas como "Dominadas o jalón pesado" o
 * "Pantorrilla de pie / máquina" cuando le dan al alumno una alternativa: en
 * esos casos vale emparejar con la primera opción, que es la principal.
 */
function variantes(nombrePdf: string): string[] {
  const lista = [nombrePdf];

  // Lo que va entre paréntesis suele ser una aclaración, no el ejercicio.
  const sinParentesis = nombrePdf.replace(/\([^)]*\)/g, " ").trim();
  if (sinParentesis && sinParentesis !== nombrePdf) lista.push(sinParentesis);

  // Primera opción cuando se ofrecen varias.
  const primeraOpcion = sinParentesis.split(/\s+o\s+|\s*\/\s*|\s*\+\s*/i)[0]?.trim();
  if (primeraOpcion && !lista.includes(primeraOpcion)) lista.push(primeraOpcion);

  // Sin los adjetivos de ejecución.
  const sinCalificadores = primeraOpcion?.toLowerCase().replace(CALIFICADORES, " ").trim();
  if (sinCalificadores && sinCalificadores.length > 2 && !lista.includes(sinCalificadores)) {
    lista.push(sinCalificadores);
  }

  return lista;
}

export function emparejarEjercicio(
  nombrePdf: string,
  biblioteca: Ejercicio[]
): EmparejamientoEjercicio {
  for (const [i, variante] of variantes(nombrePdf).entries()) {
    const r = emparejarExacto(variante, biblioteca);
    // Solo el nombre tal cual puede dar confianza máxima: si hubo que recortar
    // el texto para que emparejara, el entrenador debería poder revisarlo.
    if (r) return i === 0 ? r : { ...r, confianza: r.confianza === "exacta" ? "alta" : "media" };
  }
  return null;
}

function emparejarExacto(
  nombrePdf: string,
  biblioteca: Ejercicio[]
): EmparejamientoEjercicio {
  const objetivo = normalizar(nombrePdf);
  if (!objetivo) return null;

  // 1. Coincidencia exacta contra nombre, slug o alias.
  for (const ejercicio of biblioteca) {
    if (nombresDe(ejercicio).some((n) => normalizar(n) === objetivo)) {
      return { ejercicio, confianza: "exacta" };
    }
  }

  // 2. Uno contiene al otro ("press banca" dentro de "press de banca plano").
  //
  //    No alcanza con que uno contenga al otro: hay que mirar cuánto texto
  //    sobra. "Trepar la cuerda" contiene "cuerda" (salto a la cuerda) y son
  //    ejercicios completamente distintos — emparejarlos le mostraría al
  //    alumno el dibujo equivocado, que es peor que no mostrarle ninguno.
  //    Exigiendo que el más corto sea al menos el 60% del más largo, las
  //    palabras que sobran no pueden cambiar de qué ejercicio se habla.
  if (objetivo.length >= 5) {
    for (const ejercicio of biblioteca) {
      for (const nombre of nombresDe(ejercicio)) {
        const n = normalizar(nombre);
        if (n.length < 5) continue;
        if (!n.includes(objetivo) && !objetivo.includes(n)) continue;
        const proporcion = Math.min(n.length, objetivo.length) / Math.max(n.length, objetivo.length);
        if (proporcion >= 0.6) return { ejercicio, confianza: "alta" };
      }
    }
  }

  // 3. Palabras en común, quedándose con el mejor puntaje.
  const tokensObjetivo = tokens(nombrePdf);
  if (tokensObjetivo.length === 0) return null;

  let mejor: { ejercicio: Ejercicio; puntaje: number } | null = null;
  for (const ejercicio of biblioteca) {
    for (const nombre of nombresDe(ejercicio)) {
      const tokensNombre = tokens(nombre);
      if (tokensNombre.length === 0) continue;
      const comunes = tokensObjetivo.filter((t) => tokensNombre.includes(t)).length;
      if (comunes === 0) continue;
      // Se divide por el nombre MÁS LARGO, no por el más corto (que es lo que
      // hace la versión de alimentos). Con el más corto, cualquier ejercicio
      // de una sola palabra puntúa perfecto contra cualquier frase que la
      // mencione: "Trepar la cuerda" daba 1.0 contra "Cuerda" (saltar la
      // cuerda). Dividir por el más largo obliga a que las palabras que sobran
      // también cuenten.
      const puntaje = comunes / Math.max(tokensObjetivo.length, tokensNombre.length);
      if (!mejor || puntaje > mejor.puntaje) mejor = { ejercicio, puntaje };
    }
  }

  // Umbral alto a propósito: con 0.5 entraban cosas como "press militar" →
  // "press banca", que comparten la palabra "press" y nada más.
  //
  // Pero tiene que dejar pasar 2 de 3 palabras, que es el caso más común de
  // todos ("remo sentado en polea" contra el alias "remo sentado"). Como 2/3
  // es 0.6666…, un umbral de 0.67 lo rechazaba por centésimas.
  if (mejor && mejor.puntaje >= 0.66) {
    return { ejercicio: mejor.ejercicio, confianza: "media" };
  }
  return null;
}
