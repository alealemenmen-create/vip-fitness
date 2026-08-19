/**
 * Duración real y estable de una sesión. Recibe dos instantes explícitos para
 * que la vista histórica nunca dependa de un reloj que vuelve a arrancar en el
 * navegador y para que la función sea verificable sin tiempo global oculto.
 */
export function calcularDuracionSesionSegundos(inicio: string | null | undefined, fin: string | null | undefined) {
  if (!inicio || !fin) return 0;
  const inicioMs = Date.parse(inicio);
  const finMs = Date.parse(fin);
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= inicioMs) return 0;
  return Math.floor((finMs - inicioMs) / 1000);
}
