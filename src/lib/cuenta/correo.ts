import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cambia el correo de una cuenta directamente vía la Admin API, sin el flujo
 * de confirmación por correo de Supabase (el mismo criterio que ya usa este
 * proyecto para crear alumnos y resetear contraseñas: bypass del mailer,
 * nunca depender de un link con redirect_to frágil).
 */
export async function cambiarCorreoDeUsuario(
  userId: string,
  nuevoCorreo: string
): Promise<string | null> {
  const correo = nuevoCorreo.trim().toLowerCase();
  if (!EMAIL_RE.test(correo)) return "Ingresa un correo válido.";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: correo,
    email_confirm: true,
  });

  if (error) {
    const yaExiste = error.code === "email_exists" || error.status === 422;
    return yaExiste
      ? "Ya existe una cuenta con ese correo."
      : "No fue posible cambiar el correo. Intenta nuevamente.";
  }

  return null;
}
