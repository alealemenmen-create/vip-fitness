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
export function repsObjetivo(repsProgramadas: string | null | undefined): number | null {
  if (!repsProgramadas) return null;

  const texto = repsProgramadas.toLowerCase();

  // "30 seg" / "45s" son tiempo, no repeticiones: precargarlo como reps sería
  // un dato falso.
  if (/\b(seg|segundo|min|minuto)/.test(texto) || /\d\s*['"s]\b/.test(texto)) return null;

  const numeros = texto.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (numeros.length === 0) return null;

  // Rango explícito ("10-12", "8 a 10"): va el techo.
  const rango = texto.match(/(\d+)\s*(?:-|–|a|hasta)\s*(\d+)/);
  if (rango) return Math.max(Number(rango[1]), Number(rango[2]));

  // Series descendentes ("12/10/8") u otros formatos: el primero es el que
  // corresponde a la primera serie, y es de donde arranca el alumno.
  return numeros[0];
}
