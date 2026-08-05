/**
 * Saca de las repeticiones programadas el número con el que precargar el campo
 * que el alumno va a llenar.
 *
 * Las rutinas vienen de PDFs escritos a mano, así que el texto es de todo tipo:
 * "12", "10-12", "8 a 10", "12/10/8", "al fallo", "30 seg". La regla pedida es
 * usar el valor superior cuando es un rango — apuntar al techo del objetivo.
 *
 * Devuelve null cuando no hay un número que tenga sentido precargar (por
 * ejemplo "al fallo"): en ese caso el campo queda vacío, que es más honesto que
 * inventar una cifra.
 */
/** Mismo patrón que usa `repsObjetivo` para no confundir tiempo con
 * repeticiones, expuesto aparte: ejercicios como la plancha ("30 seg") se
 * cargan en el mismo campo pero mostrando "segundos" en vez de "reps". */
export function esEjercicioDeTiempo(repsProgramadas: string | null | undefined): boolean {
  if (!repsProgramadas) return false;
  const texto = repsProgramadas.toLowerCase();
  return /\b(seg|segundo|min|minuto)/.test(texto) || /\d\s*['"s]\b/.test(texto);
}

export function repsObjetivo(repsProgramadas: string | null | undefined): number | null {
  if (!repsProgramadas) return null;

  const texto = repsProgramadas.toLowerCase();

  // "30 seg" / "45s" son tiempo, no repeticiones: precargarlo como reps sería
  // un dato falso.
  if (esEjercicioDeTiempo(repsProgramadas)) return null;

  const numeros = texto.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (numeros.length === 0) return null;

  // Rango explícito ("10-12", "8 a 10"): va el techo.
  const rango = texto.match(/(\d+)\s*(?:-|–|a|hasta)\s*(\d+)/);
  if (rango) return Math.max(Number(rango[1]), Number(rango[2]));

  // Series descendentes ("12/10/8") u otros formatos: el primero es el que
  // corresponde a la primera serie, y es de donde arranca el alumno.
  return numeros[0];
}

/** Texto que indica una técnica o formato que un rango simple de min-max no
 * representa bien ("al fallo", "AMRAP", "10 + dropset", "8-10 + parciales").
 * Deliberadamente separado de `esEjercicioDeTiempo`: esto no decide si es
 * tiempo o reps, decide si el número que hay es confiable como meta. */
function esFormatoAmbiguo(texto: string): boolean {
  return /fallo|amrap|dropset|drop set|parcial|rest.?pause|myo|cluster|burnout|descendente|m[aá]ximo posible/.test(
    texto
  );
}

/**
 * Extrae el rango completo (mínimo y máximo) de las repeticiones programadas,
 * para el motor de doble progresión de Impulso VIP — a diferencia de
 * `repsObjetivo`, que solo devuelve el techo para precargar el input.
 *
 * "10-12" -> {min:10, max:12}. "12/10/8" (series descendentes) -> {min:8,
 * max:12}: no es un rango real, pero el motor lo usa como banda de trabajo.
 * Un número fijo ("12") da {min:12, max:12}. Deliberadamente más
 * conservador que `repsObjetivo`: cualquier texto ambiguo ("al fallo",
 * "AMRAP", "10 + dropset") devuelve null en vez de inventar un rango falso
 * — el motor de progresión directamente no genera recomendación para esos
 * ejercicios.
 */
export function rangoRepsObjetivo(repsProgramadas: string | null | undefined): { min: number; max: number } | null {
  if (!repsProgramadas) return null;
  if (esEjercicioDeTiempo(repsProgramadas)) return null;

  const texto = repsProgramadas.toLowerCase();
  if (esFormatoAmbiguo(texto)) return null;

  const numeros = texto.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (numeros.length === 0) return null;

  return { min: Math.min(...numeros), max: Math.max(...numeros) };
}
