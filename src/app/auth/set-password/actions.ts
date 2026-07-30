"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error: string | null };

export async function fijarContrasena(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const password = String(formData.get("password") || "");
  const confirmar = String(formData.get("confirmar") || "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmar) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No fue posible guardar tu contraseña. Intenta nuevamente." };
  }

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  redirect(perfil?.rol === "alumno" ? "/alumno/inicio" : "/admin/alumnos");
}
