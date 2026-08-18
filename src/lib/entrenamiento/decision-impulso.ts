/**
 * ¿El alumno ya aceptó o rechazó el reto de una intervención de Impulso VIP
 * En Vivo? Antes de esto no se guardaba en ningún lado — "Acepto el reto"
 * solo colapsaba la tarjeta (`setRetoAceptado` local), así que la serie
 * objetivo se podía completar sin haber tocado nada del Momento Impulso, y
 * al navegar a otro ejercicio y volver (la tarjeta se desmonta, ver
 * `descanso.ts`) la decisión se perdía igual.
 *
 * Mismo criterio que `descanso.ts`/`borrador.ts`: por intervención, en el
 * teléfono, con vencimiento para no arrastrar decisiones de hace días.
 */

const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

export type DecisionReto = "aceptado" | "rechazado";

function clave(intervencionId: string): string {
  return `vip:reto-impulso:${intervencionId}`;
}

export function guardarDecisionReto(intervencionId: string, decision: DecisionReto): void {
  try {
    localStorage.setItem(clave(intervencionId), `${decision}:${Date.now()}`);
  } catch {
    // Modo privado o almacenamiento lleno: la decisión sigue valiendo en
    // memoria mientras la tarjeta no se desmonte. No es motivo para romper
    // nada — ver el mismo criterio en `descanso.ts`.
  }
}

export function leerDecisionReto(intervencionId: string): DecisionReto | null {
  try {
    const crudo = localStorage.getItem(clave(intervencionId));
    if (!crudo) return null;
    const [decision, marca] = crudo.split(":");
    const cuando = Number(marca);
    if (!Number.isFinite(cuando) || Date.now() - cuando > VENCIMIENTO_MS) {
      localStorage.removeItem(clave(intervencionId));
      return null;
    }
    return decision === "aceptado" || decision === "rechazado" ? decision : null;
  } catch {
    return null;
  }
}
