/** Nombre de la rutina más corto y prolijo para la cabecera de Portal V2 --
 * el nombre real (con "(copia)" y "días" completo) sigue tal cual en el
 * panel del entrenador, donde "(copia)" es la señal de que falta renombrar
 * antes de publicar (ver rutinas-generadas/actions.ts). Esto es solo
 * cosmético en la pantalla del alumno: "Hipertrofia 5 días" se ve mejor como
 * "Hipertrofia 5D", y "(copia)" nunca debería llegarle a la vista si el
 * entrenador se olvidó de renombrarla (pedido de Alejandro, 2026-08-21). */
export function nombreCortoRutina(nombre: string): string {
  return nombre
    .replace(/\s*\(copia\)\s*$/i, "")
    .replace(/(\d+)\s*d[ií]as?\b/i, "$1D")
    .trim();
}
