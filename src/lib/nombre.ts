const PARTICULAS_MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function capitalizarParte(parte: string): string {
  return parte.replace(/(^|[-'’])(\p{L})/gu, (_coincidencia, separador: string, letra: string) => {
    return `${separador}${letra.toLocaleUpperCase("es-CL")}`;
  });
}

/**
 * Regla visual para nombres de personas publicados en la interfaz.
 * No modifica el dato almacenado: "MARIO roberto jose" se muestra como
 * "Mario Roberto Jose", conservando partículas españolas en minúscula.
 */
export function nombrePublicado(nombre: string): string {
  return nombre
    .trim()
    .toLocaleLowerCase("es-CL")
    .split(/\s+/)
    .map((parte, indice) =>
      indice > 0 && PARTICULAS_MINUSCULAS.has(parte) ? parte : capitalizarParte(parte)
    )
    .join(" ");
}

/**
 * Regla visual para nombres de alumnos.
 * No modifica el dato almacenado; normaliza espacios y muestra el nombre
 * completo en mayúsculas, aunque se haya escrito en minúsculas.
 */
export function nombreAlumnoPublicado(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-CL");
}
