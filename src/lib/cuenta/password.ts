import "server-only";

/**
 * Contraseña legible para dictar o escribir a mano — no depende de que el
 * correo llegue. La usan tanto el alta manual de alumnos como la aprobación de
 * solicitudes del link público, que entregan las credenciales por WhatsApp
 * cuando el servicio de correo no está configurado.
 */
export function generarPassword(): string {
  const bloque = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Vip${bloque()}${bloque()}`;
}
