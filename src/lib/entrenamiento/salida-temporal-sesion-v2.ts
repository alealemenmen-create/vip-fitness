const CLAVE = "vip-v2-sesion-salida-temporal";

/** Cuánto puede estar el alumno afuera (viendo Nutrición, etc.) antes de que
 * al volver se le fuerce a elegir: seguir, registrar o descartar. Menos que
 * eso, retoma directo sin interrupción. */
export const UMBRAL_AUSENCIA_MS = 5 * 60 * 1_000;

type SalidaTemporalSesionV2 = { sesionId: string; salioEn: number };

function esValida(valor: unknown): valor is SalidaTemporalSesionV2 {
  return (
    typeof valor === "object" && valor !== null
    && typeof (valor as SalidaTemporalSesionV2).sesionId === "string"
    && Number.isFinite((valor as SalidaTemporalSesionV2).salioEn)
  );
}

/** Se llama al usar "Salir un momento": guarda cuándo se fue, para poder
 * decidir al volver si retoma directo o si hay que preguntarle. */
export function marcarSalidaTemporalSesionV2(sesionId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAVE, JSON.stringify({ sesionId, salioEn: Date.now() } satisfies SalidaTemporalSesionV2));
}

/** Lectura sin consumir -- para el aviso persistente ("Entrenamiento en
 * pausa") que se muestra en el resto del portal mientras el alumno anda en
 * Nutrición u otra pestaña. Devuelve el id de sesión a la que volver, o
 * `null` si no hay ninguna salida temporal pendiente. */
export function leerSalidaTemporalSesionV2(): string | null {
  if (typeof window === "undefined") return null;
  const crudo = window.localStorage.getItem(CLAVE);
  if (!crudo) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    return esValida(valor) ? valor.sesionId : null;
  } catch {
    return null;
  }
}

/** Se llama al entrar a la sesión: si hay una salida temporal registrada para
 * esta misma sesión, la consume (se borra) y devuelve hace cuánto fue. */
export function consumirSalidaTemporalSesionV2(sesionId: string): number | null {
  if (typeof window === "undefined") return null;
  const crudo = window.localStorage.getItem(CLAVE);
  if (!crudo) return null;
  window.localStorage.removeItem(CLAVE);
  try {
    const valor: unknown = JSON.parse(crudo);
    if (!esValida(valor) || valor.sesionId !== sesionId) return null;
    return Date.now() - valor.salioEn;
  } catch {
    return null;
  }
}
