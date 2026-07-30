import "server-only";

/**
 * Envío de correo vía Resend (fetch directo a su API, sin agregar el paquete
 * como dependencia — solo hace falta un POST). Reemplaza al servicio de
 * correo de prueba de Supabase (rate limit muy bajo) para todo lo que la app
 * necesita mandar: credenciales de alumnos nuevos y recuperación de
 * contraseña. Requiere RESEND_API_KEY en el entorno; sin eso, falla con un
 * mensaje claro en vez de intentarlo silenciosamente.
 */
export async function enviarCorreo(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "No hay un servicio de correo configurado todavía (falta RESEND_API_KEY).",
    };
  }

  const from = process.env.RESEND_FROM_EMAIL || "VIP Fitness <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });

    if (!res.ok) {
      const detalle = await res.text();
      console.error("Resend error:", res.status, detalle);

      // Mientras no haya un dominio verificado, Resend solo deja enviar a la
      // dirección del dueño de la cuenta. Es el caso más frecuente al empezar,
      // así que se explica en vez de mostrar un error genérico.
      if (res.status === 403 && detalle.includes("verify a domain")) {
        return {
          ok: false,
          error:
            "El correo no salió porque todavía no hay un dominio verificado en Resend: solo se puede enviar a la casilla del gimnasio. Entrega las credenciales a mano por ahora.",
        };
      }

      return { ok: false, error: "El servicio de correo rechazó el envío. Intenta nuevamente." };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend fetch error:", err);
    return { ok: false, error: "No se pudo conectar con el servicio de correo." };
  }
}

function envoltorio(contenido: string): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <div style="background: linear-gradient(135deg, #ffc247 0%, #ffa100 55%, #f08a00 100%); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="color: #000; font-weight: 700; font-size: 20px;">VIP FITNESS</span>
      </div>
      ${contenido}
    </div>
  `;
}

export function plantillaCredenciales(input: { nombre: string; email: string; password: string; loginUrl: string }): string {
  return envoltorio(`
    <p>Hola ${input.nombre},</p>
    <p>Tu cuenta en VIP Fitness ya está lista. Podés entrar con estos datos:</p>
    <div style="background: #f4f4f4; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Correo:</strong> ${input.email}</p>
      <p style="margin: 0;"><strong>Contraseña:</strong> ${input.password}</p>
    </div>
    <p><a href="${input.loginUrl}" style="color: #ffa100; font-weight: 600;">Entrar a VIP Fitness</a></p>
    <p style="color: #666; font-size: 13px;">Podés cambiar esta contraseña cuando quieras desde "¿Olvidaste tu contraseña?" en la pantalla de entrada.</p>
  `);
}

export function plantillaRecuperacion(input: { linkRecuperacion: string }): string {
  return envoltorio(`
    <p>Pediste cambiar tu contraseña de VIP Fitness.</p>
    <p><a href="${input.linkRecuperacion}" style="color: #ffa100; font-weight: 600;">Elegir una contraseña nueva</a></p>
    <p style="color: #666; font-size: 13px;">Si no pediste esto, podés ignorar este correo — tu contraseña actual sigue funcionando.</p>
  `);
}
