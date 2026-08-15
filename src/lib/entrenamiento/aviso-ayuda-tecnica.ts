/**
 * Cuántas veces ya se mostró el aviso de "pedí ayuda" (técnica exigente:
 * drop set, rest-pause, al fallo...) en esta sesión. Tope de 3, igual que
 * Impulso VIP en vivo — pedido de Alejandro: que se sienta especial, no
 * ruido repetido cada vez que hay una técnica exigente.
 *
 * Guardado en localStorage por sesión (mismo criterio que `descanso.ts`):
 * el contador tiene que sobrevivir a navegar entre ejercicios, que
 * desmonta y vuelve a montar cada `FilaSerie`.
 */

const MAXIMO_POR_SESION = 3;
const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

function clave(sesionId: string): string {
  return `vip:avisoAyudaTecnica:${sesionId}`;
}

export function puedeMostrarAvisoAyuda(sesionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const crudo = window.localStorage.getItem(clave(sesionId));
    if (!crudo) return true;
    const { cantidad, guardadoEn } = JSON.parse(crudo) as { cantidad: number; guardadoEn: number };
    if (Date.now() - guardadoEn > VENCIMIENTO_MS) return true;
    return cantidad < MAXIMO_POR_SESION;
  } catch {
    return true;
  }
}

export function registrarAvisoAyudaMostrado(sesionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const crudo = window.localStorage.getItem(clave(sesionId));
    const actual = crudo ? (JSON.parse(crudo) as { cantidad: number }).cantidad : 0;
    window.localStorage.setItem(
      clave(sesionId),
      JSON.stringify({ cantidad: actual + 1, guardadoEn: Date.now() })
    );
  } catch {
    // localStorage lleno o deshabilitado: en el peor caso se muestra alguna
    // vez de más, no es crítico.
  }
}
