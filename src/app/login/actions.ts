"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, plantillaRecuperacion } from "@/lib/email/resend";

export type LoginState = { error: string | null };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", data.user.id)
    .single();

  if (!perfil) {
    return {
      error: "Tu cuenta no tiene un perfil de VIP Fitness asociado. Contacta a tu entrenador.",
    };
  }

  if (perfil.rol !== "alumno") redirect("/admin/alumnos");

  const { data: accesoV2 } = await supabase
    .from("alumno_perfil")
    .select("portal_v2_habilitado")
    .eq("user_id", data.user.id)
    .maybeSingle();

  redirect(accesoV2?.portal_v2_habilitado ? "/portal-v2/entrenamiento" : "/alumno/inicio");
}

export type RecuperarState = { mensaje: string | null; error: string | null };

/**
 * "Olvidé mi contraseña": genera el link de recuperación con la Admin API
 * (bypassa el mailer de prueba de Supabase, que tiene un límite muy bajo) y
 * lo manda por Resend. El link lleva a /auth/set-password, que ya sabe
 * manejar la sesión temporal que trae ese link (mismo mecanismo que las
 * invitaciones).
 *
 * Siempre devuelve el mismo mensaje de éxito exista o no la cuenta, para no
 * revelar qué correos están registrados.
 */
export async function recuperarPassword(
  _prevState: RecuperarState,
  formData: FormData
): Promise<RecuperarState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const mensajeGenerico = {
    error: null,
    mensaje: "Si ese correo tiene una cuenta, te llega un link para elegir una contraseña nueva.",
  };

  if (!email) return { error: "Ingresa tu correo.", mensaje: null };

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl}/auth/set-password` },
  });

  if (error || !data.properties?.action_link) {
    console.error("generateLink (recovery) error:", error);
    return mensajeGenerico;
  }

  const resultado = await enviarCorreo({
    to: email,
    subject: "Recuperar tu contraseña de VIP Fitness",
    html: plantillaRecuperacion({ linkRecuperacion: data.properties.action_link }),
  });
  if (!resultado.ok) console.error("recuperarPassword: envío de correo falló:", resultado.error);

  return mensajeGenerico;
}
